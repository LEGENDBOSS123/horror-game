import Composite from "./3D/Physics/Shapes/Composite.mjs";
import Sphere from "./3D/Physics/Shapes/Sphere.mjs";
import Vector3 from "./3D/Physics/Math3D/Vector3.mjs";
import Matrix3 from "./3D/Physics/Math3D/Matrix3.mjs";
import Quaternion from "./3D/Physics/Math3D/Quaternion.mjs";

var Player = class extends Composite {
    constructor(options) {
        var mass = options?.local?.body?.mass ?? 1;
        if(options?.local?.body?.mass){
            options.local.body.mass = 0;
        }
        super(options);
        this.spheres = [];
        this.spheres.push(new Sphere({
            radius: options?.radius ?? 1,
            local: {
                body: {
                    mass: 1,
                    position: new Vector3(0, 0, 0),
                }
            }
        }));
        // this.spheres.push(new Sphere({
        //     radius: options?.radius ?? 1,
        //     local: {
        //         body: {
        //             mass: 1,
        //             position: new Vector3(10, 0, 0),
        //         }
        //     }
        // }));
        for(var sphere of this.spheres){
            this.add(sphere);
        }
        this.setLocalFlag(Composite.FLAGS.CENTER_OF_MASS, true);
        this.calculatePropertiesAll();
        this.syncAll();
        this.setRestitution(0);
        this.setFriction(0);
        for(var sphere of this.spheres){
            sphere.setRestitution(0);
            sphere.setFriction(0);
        }
    }

    addToScene(scene) {
        super.addToScene(scene);
        for(var sphere of this.spheres){
            sphere.addToScene(scene);
        }
    }

    setWorld(world) {
        super.setWorld(world);
        for(var sphere of this.spheres){
            world.addComposite(sphere);
        }
    }

    setMesh(options, THREE) {
        for(var sphere of this.spheres){
            sphere.setMesh(options, THREE);
            sphere.mesh.castShadow = true;
            sphere.mesh.receiveShadow = true;
        }
    }
}



export default Player;