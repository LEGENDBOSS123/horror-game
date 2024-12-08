import SpatialHash from "../Broadphase/SpatialHash.mjs";
import CollisionDetector from "../Collision/CollisionDetector.mjs";

var World = class {
    constructor(options) {
        this.maxID = options?.maxID ?? 0;
        this.deltaTime = options?.deltaTime ?? 1;
        this.deltaTimeSquared = this.deltaTime * this.deltaTime;
        this.inverseDeltaTime = 1 / this.deltaTime;

        this.iterations = options?.iterations ?? 1;

        this.id = options?.id ?? (this.maxID++);
        this.all = options?.all ?? {};

        if (!(this in this.all)) {
            this.all[this.id] = this;
        }

        this.composites = options?.composites ?? [];
        this.spatialHash = options?.spatialHash ?? new SpatialHash({ world: this });
        this.collisionDetector = options?.collisionDetector ?? new CollisionDetector({ world: this });
    }

    setDeltaTime(deltaTime) {
        this.deltaTime = deltaTime;
        this.deltaTimeSquared = this.deltaTime * this.deltaTime;
        this.inverseDeltaTime = 1 / this.deltaTime;
    }

    setIterations(iterations) {
        this.iterations = iterations;
        this.setDeltaTime(1 / this.iterations);
    }

    addComposite(composite) {
        this.add(composite);
        this.composites.push(composite);
    }

    add(element) {
        element.id = (this.maxID++);
        element.setWorld(this);
        this.all[element.id] = element;
        return element;
    }

    updateBeforeCollisionAll() {
        for (var i = 0; i < this.composites.length; i++) {
            if (this.composites[i].isMaxParent()) {
                this.composites[i].updateBeforeCollisionAll();
            }
        }
    }

    updateAfterCollisionAll() {
        for (var i = 0; i < this.composites.length; i++) {
            if (this.composites[i].isMaxParent()) {
                this.composites[i].updateAfterCollisionAll();
            }
        }
    }

    step() {
        for (var i = 0; i < this.iterations; i++) {
            this.updateBeforeCollisionAll();
            this.collisionDetector.handleAll(this.composites);
            this.collisionDetector.resolveAll();
            this.updateAfterCollisionAll();
        }
    }

    toJSON(){
        var world = {};

        world.maxID = this.maxID;
        world.deltaTime = this.deltaTime;
        world.deltaTimeSquared = this.deltaTimeSquared;
        world.inverseDeltaTime = this.inverseDeltaTime;
        world.iterations = this.iterations;
        world.id = this.id;
        world.all = [];

        for (var i in this.all) {
            world.all.push(this.all[i].toJSON());
        }

        world.composites = [];
        for (var i = 0; i < this.composites.length; i++) {
            world.composites.push(this.composites[i].id);
        }

        world.spatialHash = this.spatialHash.toJSON();
        world.collisionDetector = this.collisionDetector.toJSON();

        return world;
    }
};


export default World;