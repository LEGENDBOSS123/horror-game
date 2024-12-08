import Vector3 from "../Math3D/Vector3.mjs";


var Contact = class {
    constructor(options) {

        this.solved = options?.shared?.solved ?? false;
        this.impulse = options?.impulse;

        this.normal = options?.normal;
        this.penetration = options?.penetration;

        this.body1 = options?.body1;
        this.body2 = options?.body2;

        this.point = options?.point;
        this.velocity = options?.velocity;

        this.combinedMaterial = options?.combinedMaterial;
    }

    solve() {
        if (this.solved) {
            return;
        }
        var impactSpeed = this.velocity.dot(this.normal);
        var force = new Vector3();
        var restitution = this.material.restitution;
        var radius1 = this.point.subtract(this.body1.maxParent.global.body.position);
        var radius2 = this.point.subtract(this.body2.maxParent.global.body.position);

        var rotationalEffects1 = this.normal.dot(this.body1.maxParent.global.body.inverseMomentOfInertia.multiplyVector3(radius1.cross(this.normal)).cross(radius1));
        var rotationalEffects2 = this.normal.dot(this.body2.maxParent.global.body.inverseMomentOfInertia.multiplyVector3(radius2.cross(this.normal)).cross(radius2));
        rotationalEffects1 = isFinite(rotationalEffects1) ? rotationalEffects1 : 0;
        rotationalEffects2 = isFinite(rotationalEffects2) ? rotationalEffects2 : 0;

        var tangential = this.velocity.projectOntoPlane(this.normal);
        var tangentialNorm = tangential.normalize();
        var rotationalEffects1Fric = tangentialNorm.dot(this.body1.maxParent.global.body.inverseMomentOfInertia.multiplyVector3(radius1.cross(tangentialNorm)).cross(radius1));
        var rotationalEffects2Fric = tangentialNorm.dot(this.body2.maxParent.global.body.inverseMomentOfInertia.multiplyVector3(radius2.cross(tangentialNorm)).cross(radius2));
        rotationalEffects1Fric = isFinite(rotationalEffects1Fric) ? rotationalEffects1Fric : 0;
        rotationalEffects2Fric = isFinite(rotationalEffects2Fric) ? rotationalEffects2Fric : 0;
        
        var denominator = this.body1.maxParent.global.body.inverseMass + rotationalEffects1 * (1 - this.body1.maxParent.global.body.angularDamping);

        denominator += this.body2.maxParent.global.body.inverseMass + rotationalEffects2 * (1 - this.body2.maxParent.global.body.angularDamping);

        var denominatorFric = this.body1.maxParent.global.body.inverseMass + rotationalEffects1Fric * (1 - this.body1.maxParent.global.body.angularDamping);

        denominatorFric += this.body2.maxParent.global.body.inverseMass + rotationalEffects2Fric * (1 - this.body2.maxParent.global.body.angularDamping);
        

        var impulse = - (1 + restitution) * impactSpeed / denominator;

        if (impulse < 0) {
            impulse = 0;
        }

        
        var maxFriction = tangential.magnitude() / denominatorFric;
        tangential.normalizeInPlace();
        var friction = impulse * this.material.friction;
        force.addInPlace(tangential.scale(-1 * Math.max(0, Math.min(maxFriction, friction))));
        force.addInPlace(this.normal.scale(impulse));
        this.impulse = force;
        this.solved = true;
        return;
    }

    copy() {
        var c = new this.constructor();
        c.normal = this.normal.copy();
        c.penetration = this.penetration;

        c.body1 = this.body1;
        c.body2 = this.body2;
        c.point = this.point;
        c.velocity = this.velocity;

        c.solved = this.solved;
        c.impulse = this.impulse;

        c.combinedMaterial = this.combinedMaterial;
        return c;
    }
};

export default Contact;