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
        this.sunlight.position.copy(this.camera.position);
        this.sunlight.position.sub(this.sunlight.direction.clone().multiplyScalar(this.sunlight.shadow.camera.far * 0.5));
        this.sunlight.target.position.addVectors(this.sunlight.position, this.sunlight.direction);
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

        this.sunlight = new THREE.DirectionalLight(0xffffff, 1);
        this.sunlight.direction = new THREE.Vector3(0,-1,0).normalize();
        this.sunlight.castShadow = true;
        this.sunlight.shadow.mapSize.width = 8192;
        this.sunlight.shadow.mapSize.height = 8192;
        var range = 512;
        this.sunlight.shadow.camera.near = 0.5;
        this.sunlight.shadow.camera.far = 4096;
        this.sunlight.shadow.camera.left = -range;
        this.sunlight.shadow.camera.right = range;
        this.sunlight.shadow.camera.top = range;
        this.sunlight.shadow.camera.bottom = -range;
        this.scene.add(this.sunlight);
        this.scene.add(this.sunlight.target);

    }

    setSunlightDirection(direction) {
        this.sunlight.direction = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
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