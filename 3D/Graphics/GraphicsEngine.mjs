import * as THREE from "three";
import { EffectComposer, RenderPass, ShaderPass} from "postprocessing";
import { N8AOPostPass } from './N8AO.mjs';
import AutoTextureLoader from "./AutoTextureLoader.mjs";


var GraphicsEngine = class {
    constructor(options) {
        this.window = options?.window ?? window;
        this.document = options?.document ?? document;

        this.container = options?.canvas?.parent ?? this.document.body;
        this.renderer = new THREE.WebGLRenderer({
            canvas: options?.canvas ?? null
        });

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        this.renderer.physicallyCorrectLights = true;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = true;

        this.screenWidth = this.container.clientWidth;
        this.screenHeight = this.container.clientHeight;

        var resizeObserver = new ResizeObserver(function () {
            this.screenWidth = this.container.clientWidth;
            this.screenHeight = this.container.clientHeight;
            this.updateScreenSize();
        }.bind(this));
        resizeObserver.observe(this.container);



        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(options?.camera?.fov ?? 80, this.aspectRatio(), options?.camera?.near ?? 0.1, options?.camera?.far ?? 4096);
        
        this.scene.add(this.camera);

        this.textureLoader = new AutoTextureLoader();

        this.composer = new EffectComposer(this.renderer);
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.renderPass.renderToScreen = false;
        this.composer.addPass(this.renderPass);
        this.n8aoPass = new N8AOPostPass(this.scene, this.camera, this.screenWidth, this.screenHeight);
        this.n8aoPass.configuration.aoRadius = 2;
        this.n8aoPass.setQualityMode("Low");
        this.n8aoPass.renderToScreen = false;
        this.composer.addPass(this.n8aoPass);
        this.lights = [];
        this.setupLights();

        this.updateScreenSize();
    }

    updateScreenSize() {
        this.renderer.setSize(this.screenWidth, this.screenHeight);
        this.composer.setSize(this.screenWidth, this.screenHeight);
        this.camera.aspect = this.aspectRatio();
        this.camera.updateProjectionMatrix();
    }

    aspectRatio() {
        return this.screenWidth / this.screenHeight;
    }

    render() {
        this.closeSunlight.position.copy(this.camera.position);
        this.closeSunlight.position.sub(this.closeSunlight.direction.clone().multiplyScalar(this.closeSunlight.shadow.camera.far * 0.5));
        this.closeSunlight.target.position.addVectors(this.closeSunlight.position, this.closeSunlight.direction);

        this.farSunlight.position.copy(this.closeSunlight.position);
        this.farSunlight.target.position.copy(this.closeSunlight.target.position);
        this.composer.render();
    }

    setBackgroundImage(url, setBackground = true, setEnvironment = false) {
        this.textureLoader.load(url, function (texture, extension) {
            var pmremGenerator = new THREE.PMREMGenerator(this.renderer);
            pmremGenerator.compileEquirectangularShader();
            texture = pmremGenerator.fromEquirectangular(texture).texture;
            pmremGenerator.dispose();
            
            if (setBackground) {
                this.scene.background = texture;
            }

            if (setEnvironment) {
                this.scene.environment = texture;
            }

            texture.dispose();
            
        }.bind(this));
    }

    setupLights() {

        this.ambientLight = new THREE.AmbientLight(0xbbbbbb, 2);
        this.scene.add(this.ambientLight);

        var range = 32;

        this.closeSunlight = new THREE.DirectionalLight(0xffffff, 0.5);
        this.closeSunlight.direction = new THREE.Vector3(0,-1,0);
        this.closeSunlight.castShadow = true;
        this.closeSunlight.shadow.mapSize.width = 2048;
        this.closeSunlight.shadow.mapSize.height = 2048;
        this.closeSunlight.shadow.camera.near = 0.1;
        this.closeSunlight.shadow.camera.far = 4096;
        this.closeSunlight.shadow.camera.left = -range;
        this.closeSunlight.shadow.camera.right = range;
        this.closeSunlight.shadow.camera.top = range;
        this.closeSunlight.shadow.camera.bottom = -range;
        this.closeSunlight.shadow.bias = -0.0001;
        this.scene.add(this.closeSunlight);
        this.scene.add(this.closeSunlight.target);

        range = 256;

        this.farSunlight = new THREE.DirectionalLight(0xffffff, 0.5);
        this.farSunlight.direction = new THREE.Vector3(0,-1,0);
        this.farSunlight.castShadow = true;
        this.farSunlight.shadow.mapSize.width = 4096;
        this.farSunlight.shadow.mapSize.height = 4096;
        this.farSunlight.shadow.camera.near = 0.1;
        this.farSunlight.shadow.camera.far = 4096;
        this.farSunlight.shadow.camera.left = -range;
        this.farSunlight.shadow.camera.right = range;
        this.farSunlight.shadow.camera.top = range;
        this.farSunlight.shadow.camera.bottom = -range;
        this.farSunlight.shadow.bias = -0.0001;
        this.scene.add(this.farSunlight);
        this.scene.add(this.farSunlight.target);

        this.lights.push(this.closeSunlight);
        this.lights.push(this.farSunlight);

    }

    setSunlightDirection(direction) {
        this.closeSunlight.direction = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
        this.farSunlight.direction = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
    }

    setSunlightBrightness(brightness) {
        this.closeSunlight.intensity = brightness/2;
        this.farSunlight.intensity = brightness/2;
    }

    disableSunlight(){
        this.closeSunlight.visible = false;
        this.farSunlight.visible = false;
    }

    enableSunlight(){
        this.closeSunlight.visible = true;
        this.farSunlight.visible = true;
    }


    addToScene(object) {
        this.scene.add(object);
    }

    load(url, onLoad, onProgress, onError){
        this.textureLoader.load(url, onLoad, onProgress, onError);
    }

    enableAO() {
        if(this.n8aoPass.enabled){
            return;
        }
        this.n8aoPass.enabled = true;
        this.composer.addPass(this.n8aoPass);
    }

    disableAO() {
        if(!this.n8aoPass.enabled){
            return;
        }
        this.n8aoPass.enabled = false;
        this.composer.removePass(this.n8aoPass);

    }
}



export default GraphicsEngine;