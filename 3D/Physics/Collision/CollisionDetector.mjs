import Vector3 from "../Math3D/Vector3.mjs";
import Contact from "./Contact.mjs";
import Triangle from "../Shapes/Triangle.mjs";
import Composite from "../Shapes/Composite.mjs";
var CollisionDetector = class {

    static seperatorCharacter = ":";

    constructor(options) {
        this.pairs = options?.pairs ?? new Map();
        this.world = options?.world ?? null;
        this.contacts = options?.contacts ?? [];
        this.handlers = [];
        this.initHandlers();
    }

    inPairs(shape1, shape2) {
        if (shape1.id > shape2.id) {
            return this.pairs.has(shape2.id + this.constructor.seperatorCharacter + shape1.id);
        }

        return this.pairs.has(shape1.id + this.constructor.seperatorCharacter + shape2.id);
    }

    addContact(contact) {
        this.contacts.push(contact);
    }

    addPair(shape1, shape2) {
        if(!shape1.canCollideWith(shape2)){
            return;
        }
        if(!shape1.global.hitbox.intersects(shape2.global.hitbox)){
            return;
        }
        if(shape1.id > shape2.id){
            var temp = shape1;
            shape1 = shape2;
            shape2 = temp;
        }
        if(!this.handlers[shape1.shape]?.[shape2.shape]){
            return;
        }
        return this.pairs.set(shape1.id + this.constructor.seperatorCharacter + shape2.id, [shape1, shape2]);
    }

    detectCollision(shape1, shape2) {
        if (shape1.maxParent == shape2.maxParent) {
            return false;
        }
        if (shape1.getLocalFlag(Composite.FLAGS.STATIC) && shape2.getLocalFlag(Composite.FLAGS.STATIC)) {
            return false;
        }
        if (shape1.shape > shape2.shape) {
            var temp = shape1;
            shape1 = shape2;
            shape2 = temp;
        }
        return this.handlers[shape1.shape]?.[shape2.shape]?.bind(this)(shape1, shape2);
    }

    initHandlers() {
        this.handlers[Composite.SHAPES.SPHERE] = {};
        this.handlers[Composite.SHAPES.SPHERE][Composite.SHAPES.SPHERE] = this.handleSphereSphere;
        this.handlers[Composite.SHAPES.SPHERE][Composite.SHAPES.TERRAIN3] = this.handleSphereTerrain;
        this.handlers[Composite.SHAPES.SPHERE][Composite.SHAPES.BOX] = this.handleSphereBox;

        this.handlers[Composite.SHAPES.TERRAIN3] = {};
        this.handlers[Composite.SHAPES.TERRAIN3][Composite.SHAPES.POINT] = this.handleTerrainPoint;

        this.handlers[Composite.SHAPES.BOX] = {};
    }

    handle(shape) {
        var query = this.world.spatialHash.query(shape.id);
        for (var i of query) {
            this.addPair(shape, this.world.all[i]);
        }
    }

    handleAll(shapes) {
        for (var i = 0; i < shapes.length; i++) {
            this.handle(shapes[i]);
        }
    }


    resolveAll() {
        for (var [key, value] of this.pairs) {
            this.detectCollision(value[0], value[1]);
        }
        this.resolveAllContacts();
        this.pairs.clear();
    }

    broadphase(shape1, shape2) {
        return shape1.global.hitbox.intersects(shape2.global.hitbox);
    }

    resolveAllContacts() {
        var maxParentMap = new Map();
        for (var i = 0; i < this.contacts.length; i++) {
            var contact = this.contacts[i];
            if (!maxParentMap.has(contact.body1.maxParent.id)) {
                maxParentMap.set(contact.body1.maxParent.id, { penetrationSum: 0, contacts: [], totalImpulse: new Vector3() });
            }

            if (!maxParentMap.has(contact.body2.maxParent.id)) {
                maxParentMap.set(contact.body2.maxParent.id, { penetrationSum: 0, contacts: [], totalImpulse: new Vector3() });
            }
            contact.material = contact.body1.material.getCombined(contact.body2.material);

            var contacts = maxParentMap.get(contact.body1.maxParent.id).contacts;
            contacts.push(contact);
            maxParentMap.get(contact.body1.maxParent.id).penetrationSum += contact.penetration.magnitude();

            contacts = maxParentMap.get(contact.body2.maxParent.id).contacts;
            contacts.push(contact);
            maxParentMap.get(contact.body2.maxParent.id).penetrationSum += contact.penetration.magnitude();
        }


        for (var [key, value] of maxParentMap) {
            for (var i = 0; i < value.contacts.length; i++) {
                var contact = value.contacts[i];
                contact.solve();
                if (key == contact.body1.maxParent.id) {
                    if(contact.body1.preCollisionCallback){
                        contact.body1.preCollisionCallback(contact);
                    }
                    maxParentMap.get(contact.body1.maxParent.id).totalImpulse.addInPlace(contact.impulse);
                    contact.body1.maxParent.applyForce(contact.impulse.scale(contact.penetration.magnitude() / maxParentMap.get(contact.body1.maxParent.id).penetrationSum), contact.point);
                }
                else {
                    if(contact.body2.preCollisionCallback){
                        contact.body2.preCollisionCallback(contact);
                    }
                    maxParentMap.get(contact.body2.maxParent.id).totalImpulse.addInPlace(contact.impulse);
                    contact.body2.maxParent.applyForce(contact.impulse.scale(-contact.penetration.magnitude() / maxParentMap.get(contact.body2.maxParent.id).penetrationSum), contact.point);
                }
            }
        }
        var totalTranslation = new Vector3();
        for (var [key, value] of maxParentMap) {
            totalTranslation.reset();
            for (var i = 0; i < value.contacts.length; i++) {
                var contact = value.contacts[i];
                var translation = contact.penetration;
                var totalMass = contact.body1.maxParent.global.body.mass + contact.body2.maxParent.global.body.mass;

                if (key == contact.body1.maxParent.id) {
                    var massRatio2 = contact.body2.maxParent.global.body.mass / totalMass;
                    massRatio2 = isNaN(massRatio2) ? 1 : massRatio2;
                    totalTranslation.addInPlace(translation.scale(contact.penetration.magnitude() / maxParentMap.get(contact.body1.maxParent.id).penetrationSum * massRatio2));
                }
                else {
                    var massRatio1 = contact.body1.maxParent.global.body.mass / totalMass;
                    massRatio1 = isNaN(massRatio1) ? 1 : massRatio1;
                    totalTranslation.addInPlace(translation.scale(-contact.penetration.magnitude() / maxParentMap.get(contact.body2.maxParent.id).penetrationSum * massRatio1));
                }

            }
            if (key == contact.body1.maxParent.id) {
                contact.body1.translate(totalTranslation);
            }
            else {
                contact.body2.translate(totalTranslation);
            }
        }
        this.contacts.length = 0;
    }

    getClosestPointToAABB(v, aabb) {
        var dimensions = new Vector3(aabb.width, aabb.height, aabb.depth).scale(0.5);
        if(v.x > -dimensions.x && v.x < dimensions.x && v.y > -dimensions.y && v.y < dimensions.y && v.z > -dimensions.z && v.z < dimensions.z) {
            return v;
        }
        if (v.x < -dimensions.x) {
            v.x = -dimensions.x;
        }
        else if (v.x > dimensions.x) {
            v.x = dimensions.x;
        }
        if (v.y < -dimensions.y) {
            v.y = -dimensions.y;
        }
        else if (v.y > dimensions.y) {
            v.y = dimensions.y;
        }
        if (v.z < -dimensions.z) {
            v.z = -dimensions.z;
        }
        else if (v.z > dimensions.z) {
            v.z = dimensions.z;
        }
        return v;
    }
    
    timeOfImpactSphereAABB(initialSpherePos, finalSpherePos, sphereRadius,
        initialAABBMin, initialAABBMax, finalAABBMin, finalAABBMax) {

        let toiMin = 0.0;  // Start of the time interval
        let toiMax = 1.0;  // End of the time interval

        // Loop over all three axes (x, y, z)
        for (let i = 0; i < 3; i++) {
            const sphereInitial = initialSpherePos.toArray()[i];
            const sphereFinal = finalSpherePos.toArray()[i];
            const sphereVelocity = sphereFinal - sphereInitial;

            const aabbInitialMin = initialAABBMin.toArray()[i];
            const aabbInitialMax = initialAABBMax.toArray()[i];
            const aabbFinalMin = finalAABBMin.toArray()[i];
            const aabbFinalMax = finalAABBMax.toArray()[i];
            const aabbVelocityMin = aabbFinalMin - aabbInitialMin;
            const aabbVelocityMax = aabbFinalMax - aabbInitialMax;

            // Check for stationary sphere relative to AABB on this axis
            if (sphereVelocity === 0 && aabbVelocityMin === 0 && aabbVelocityMax === 0) {
                const closestPoint = new Vector3(sphereInitial, sphereInitial, sphereInitial).clamp(initialAABBMin, initialAABBMax);
                if (initialSpherePos.distance(closestPoint) > sphereRadius) {
                    return null;  // No collision if distance is greater than radius
                }
                continue;
            }

            // Calculate entry and exit times on this axis
            let entryTime = -Infinity;
            let exitTime = Infinity;

            if (sphereVelocity !== 0) {
                // Moving sphere relative to the AABB
                const invVelocity = 1.0 / sphereVelocity;

                const entryMin = (aabbInitialMin - sphereInitial - sphereRadius) * invVelocity;
                const entryMax = (aabbInitialMax - sphereInitial + sphereRadius) * invVelocity;

                entryTime = Math.min(entryMin, entryMax);
                exitTime = Math.max(entryMin, entryMax);
            }

            // AABB moving relative to the sphere
            if (aabbVelocityMin !== 0 || aabbVelocityMax !== 0) {
                const invVelocityMin = 1.0 / aabbVelocityMin;
                const invVelocityMax = 1.0 / aabbVelocityMax;

                const aabbEntryMin = (sphereInitial - aabbInitialMax - sphereRadius) * invVelocityMin;
                const aabbEntryMax = (sphereInitial - aabbInitialMin + sphereRadius) * invVelocityMax;

                entryTime = Math.max(entryTime, Math.min(aabbEntryMin, aabbEntryMax));
                exitTime = Math.min(exitTime, Math.max(aabbEntryMin, aabbEntryMax));
            }

            // Update global TOI
            toiMin = Math.max(toiMin, entryTime);
            toiMax = Math.min(toiMax, exitTime);

            if (toiMin > toiMax) {
                return null;  // No collision
            }
        }

        // Return the exact time of impact (TOI)
        return toiMin >= 0 && toiMin <= 1 ? toiMin : null;
    }
    handleSphereBox(sphere1, box1) {
        var spherePos = sphere1.global.body.position;
        var dimensions = new Vector3(box1.width, box1.height, box1.depth).scale(0.5);
        var relativePos = box1.translateWorldToLocal(spherePos);
        var dimensions2 = new Vector3(sphere1.radius, sphere1.radius, sphere1.radius).scale(0).addInPlace(dimensions);
        
        

        var prevPos = box1.global.body.rotation.conjugate().multiplyVector3(sphere1.global.body.actualPreviousPosition.subtract(box1.global.body.actualPreviousPosition));

        var delta = relativePos.subtract(prevPos);
        
        var t = this.timeOfImpactSphereAABB(prevPos, relativePos, sphere1.radius * 0, dimensions2.scale(-1), dimensions2, dimensions2.scale(-1), dimensions2);
        
        if (t !== null) {
            var pos = prevPos.addInPlace(delta.scale(t - 0.0001));
            var closest = this.getClosestPointToAABB(pos.copy(), box1);
            if (pos.distanceSquared(closest) > 0 && pos.distanceSquared(closest) < sphere1.radius * sphere1.radius) {
                var contact = new Contact();

                var normal = pos.subtract(closest).normalize();
                normal.x = Math.round(normal.x);
                normal.y = Math.round(normal.y);
                normal.z = Math.round(normal.z);
                //var posToWorld = box1.translateLocalToWorld(pos);

                contact.point = box1.translateLocalToWorld(closest);
                contact.normal = box1.global.body.rotation.multiplyVector3(normal);
                contact.penetration = contact.normal.scale(sphere1.radius).add(contact.point).subtract(spherePos);

                contact.body1 = sphere1;
                contact.body2 = box1;
                contact.point = sphere1.global.body.position.subtract(contact.normal.scale(sphere1.radius));
                contact.velocity = sphere1.getVelocityAtPosition(contact.point).subtractInPlace(box1.getVelocityAtPosition(contact.point));
                this.addContact(contact);
                return true;

            }


        }
        //}

        if (!(relativePos.x >= dimensions.x || relativePos.y >= dimensions.y || relativePos.z >= dimensions.z || relativePos.x <= -dimensions.x || relativePos.y <= -dimensions.y || relativePos.z <= -dimensions.z)) {
            //var prevPos = box1.global.body.rotation.conjugate().multiplyVector3(sphere1.global.body.previousPosition.subtract(box1.global.body.previousPosition));
            //if (!(prevPos.x >= dimensions.x || prevPos.y >= dimensions.y || prevPos.z >= dimensions.z || prevPos.x <= -dimensions.x || prevPos.y <= -dimensions.y || prevPos.z <= -dimensions.z)) {
                var penetrationValues = new Vector3(relativePos.x - dimensions.x, relativePos.y - dimensions.y, relativePos.z - dimensions.z);
                if (relativePos.x < 0) {
                    penetrationValues.x = relativePos.x + dimensions.x;
                }
                if (relativePos.y < 0) {
                    penetrationValues.y = relativePos.y + dimensions.y;
                }
                if (relativePos.z < 0) {
                    penetrationValues.z = relativePos.z + dimensions.z;
                }
                var absPenetrationValues = new Vector3(Math.abs(penetrationValues.x), Math.abs(penetrationValues.y), Math.abs(penetrationValues.z));
                var contactPoint = new Vector3();
                if (absPenetrationValues.x < absPenetrationValues.y && absPenetrationValues.x < absPenetrationValues.z) {
                    contactPoint = new Vector3(penetrationValues.x, 0, 0);
                }
                else if (absPenetrationValues.y < absPenetrationValues.z) {
                    contactPoint = new Vector3(0, penetrationValues.y, 0);
                }
                else {
                    contactPoint = new Vector3(0, 0, penetrationValues.z);
                }
                var contact = new Contact();
                contactPoint = box1.translateLocalToWorld(contactPoint.addInPlace(relativePos));

                contact.point = contactPoint;

                
                contact.normal = spherePos.subtract(contactPoint).normalizeInPlace();
                contact.velocity = sphere1.getVelocityAtPosition(contact.point).subtractInPlace(box1.getVelocityAtPosition(contact.point));
                contact.penetration = contact.normal.scale(sphere1.radius + contactPoint.distance(spherePos));
                contact.body1 = sphere1;
                contact.body2 = box1;

                this.addContact(contact);
                return true;
            //}
        }


        var closestClampedPoint = this.getClosestPointToAABB(relativePos.copy(), box1);
        var distanceSquared = closestClampedPoint.subtract(relativePos).magnitudeSquared();
        if (distanceSquared >= sphere1.radius * sphere1.radius) {
            return false;
        }
        var contact = new Contact();
        var closestClampedPointToWorld = box1.translateLocalToWorld(closestClampedPoint);
        
        

        contact.normal = spherePos.subtract(closestClampedPointToWorld).normalizeInPlace();
        contact.point = sphere1.global.body.position.subtract(contact.normal.scale(sphere1.radius));
        if (contact.normal.magnitudeSquared() == 0) {
            contact.normal = new Vector3(1, 0, 0);
        }
        contact.velocity = sphere1.getVelocityAtPosition(contact.point).subtractInPlace(box1.getVelocityAtPosition(contact.point));
        contact.penetration = contact.normal.scale(sphere1.radius - Math.sqrt(distanceSquared));
        contact.body1 = sphere1;
        contact.body2 = box1;
        this.addContact(contact);
        return true;
    }


    handleSphereSphere(sphere1, sphere2) {
        var distanceTo = sphere1.global.body.position.distance(sphere2.global.body.position);
        if (distanceTo >= sphere1.radius + sphere2.radius) {
            return false;
        }
        var contact = new Contact();
        contact.normal = sphere1.global.body.position.subtract(sphere2.global.body.position).normalizeInPlace();
        if (contact.normal.magnitudeSquared() == 0) {
            contact.normal = new Vector3(1, 0, 0);
        }
        contact.point = sphere1.global.body.position.add(sphere2.global.body.position).scale(0.5);
        contact.velocity = sphere1.getVelocityAtPosition(contact.point).subtractInPlace(sphere2.getVelocityAtPosition(contact.point));


        contact.body1 = sphere1;
        contact.body2 = sphere2;
        contact.penetration = contact.normal.scale(sphere1.radius + sphere2.radius - distanceTo);
        if (contact.penetration <= 0) {
            return false;
        }
        this.addContact(contact);
        return;
    }

    handleSphereTerrain(sphere1, terrain1) {
        var spherePos = sphere1.global.body.position;

        var translatedSpherePos = terrain1.translateWorldToLocal(spherePos);
        var heightmapPos = terrain1.translateLocalToHeightmap(translatedSpherePos);
        var heightmapSphereWidth = sphere1.radius * terrain1.inverseTerrainScale;

        if (heightmapPos.x <= -heightmapSphereWidth || heightmapPos.x >= terrain1.heightmaps.widthSegments + heightmapSphereWidth || heightmapPos.z <= -heightmapSphereWidth || heightmapPos.z >= terrain1.heightmaps.depthSegments + heightmapSphereWidth) {
            return false;
        }

        var min = new Vector3(heightmapPos.x - heightmapSphereWidth, 0, heightmapPos.z - heightmapSphereWidth);
        var max = new Vector3(heightmapPos.x + heightmapSphereWidth, 0, heightmapPos.z + heightmapSphereWidth);
        var top = [];
        for (var i = 0; i < 3; i++) {
            top[i] = [-Infinity, null];
        }
        var handled = false;
        for (var x = min.x - 1; x <= max.x + 1; x++) {
            for (var z = min.z - 1; z <= max.z + 1; z++) {
                var triangles = terrain1.getTrianglePair(terrain1.heightmaps.top, new Vector3(x, 0, z));
                if (!triangles) {
                    continue;
                }
                for (var triangle of triangles) {
                    if (!triangle) {
                        continue;
                    }
                    triangle.a = terrain1.translateHeightmapToWorld(triangle.a);
                    triangle.b = terrain1.translateHeightmapToWorld(triangle.b);
                    triangle.c = terrain1.translateHeightmapToWorld(triangle.c);
                    var boundingSphere = triangle.makeBoundingSphere();
                    if (spherePos.subtract(boundingSphere.center).magnitudeSquared() >= (boundingSphere.radius + sphere1.radius) * (boundingSphere.radius + sphere1.radius)) {
                        continue;
                    }
                    var intersection = triangle.intersectsSphere(spherePos);
                    if (!intersection) {
                        continue;
                    }
                    var contact = new Contact();
                    contact.point = intersection;
                    contact.penetration = contact.normal.scale(sphere1.radius - contact.point.distance(spherePos));
                    if (contact.penetration <= 0) {
                        continue;
                    }
                    contact.normal = spherePos.subtract(intersection).normalizeInPlace();
                    if (contact.normal.dot(triangle.getNormal()) < 0) {
                        continue;
                    }
                    if (contact.normal.magnitudeSquared() == 0) {
                        contact.normal = new Vector3(1, 0, 0);
                    }
                    contact.body1 = sphere1;
                    contact.body2 = terrain1;

                    contact.velocity = sphere1.getVelocityAtPosition(contact.point).subtractInPlace(terrain1.getVelocityAtPosition(contact.point));
                    for (var i = 0; i < top.length; i++) {
                        if (contact.penetration >= top[i][0]) {
                            top[i][0] = contact.penetration;
                            if (top[i][1]) {
                                if (top[i][1].point.equals(contact.point) && top[i][1].normal.equals(contact.normal)) {
                                    break;
                                }
                            }
                            top[i][1] = contact;
                            break;
                        }
                    }
                }
            }
        }
        var cnt = this.handleTerrainPoint(terrain1, sphere1, true);
        if (cnt) {
            cnt.penetration += sphere1.radius / 2;
            if (cnt.penetration > 0) {
                this.addContact(cnt);
            }
        }
        for (var i = 0; i < top.length; i++) {
            if (top[i][1]) {
                this.addContact(top[i][1]);
                handled = true;
            }
        }

    }

    handleTerrainPoint(terrain1, point1, manual = false) {
        var pointPos = point1.global.body.position;

        var pointPosPrev = point1.global.body.actualPreviousPosition;
        var translatedPointPos = terrain1.translateWorldToLocal(pointPos);
        var heightmapPos = terrain1.translateLocalToHeightmap(translatedPointPos);
        var translatedPointPosPrev = terrain1.translateWorldToLocal(pointPosPrev);
        var heightmapPosPrev = terrain1.clampToHeightmap(terrain1.translateLocalToHeightmap(translatedPointPosPrev));

        if (heightmapPos.x <= 0 || heightmapPos.x >= terrain1.heightmaps.widthSegments || heightmapPos.z <= 0 || heightmapPos.z >= terrain1.heightmaps.depthSegments) {
            return false;
        }

        var triangleTop = terrain1.getTriangle(terrain1.heightmaps.top, heightmapPos);
        var triangleBottom = terrain1.getTriangle(terrain1.heightmaps.bottom, heightmapPos);

        var triangle = new Triangle(triangleTop.a.add(triangleBottom.a).scaleInPlace(0.5), triangleTop.b.add(triangleBottom.b).scaleInPlace(0.5), triangleTop.c.add(triangleBottom.c).scaleInPlace(0.5));


        var height = 0;
        var top = true;
        var normal = new Vector3(1, 0, 0);
        var height1 = triangle.getHeight(heightmapPosPrev);
        var height2 = triangle.getHeight(heightmapPosPrev);
        // if(1==0 && heightmapPos.y > height1.y && heightmapPosPrev.y > height2.y){

        //     top = true;
        // }
        // else if(1==0 && heightmapPos.y < height1.y && heightmapPosPrev.y < height2.y){
        //     top = false;
        // }
        // else{
        //     var triangle2 = triangle.copy();
        //     triangle2.a = terrain1.translateHeightmapToWorld(triangle2.a);
        //     triangle2.b = terrain1.translateHeightmapToWorld(triangle2.b);
        //     triangle2.c = terrain1.translateHeightmapToWorld(triangle2.c);

        //     var velocity = point1.global.body.getVelocity();//pointPos.subtract(p);
        //     normal = triangle2.getNormal();
        //     var pointVelocity = velocity.dot(normal);
        //     if(pointVelocity > 0){
        //         //top = false;
        //     }
        // }

        if (top) {
            var height = terrain1.translateHeightmapToWorld(triangleTop.getHeight(heightmapPos));
            var triangle2 = triangleTop.copy();
            triangle2.a = terrain1.translateHeightmapToWorld(triangle2.a);
            triangle2.b = terrain1.translateHeightmapToWorld(triangle2.b);
            triangle2.c = terrain1.translateHeightmapToWorld(triangle2.c);
            var normal = triangle2.getNormal();
            var contact = new Contact();
            contact.normal = normal;
            contact.penetration = contact.normal.scale(triangle2.a.subtract(pointPos).dot(contact.normal));
            if (contact.penetration <= 0 && !manual) {
                return false;
            }
            contact.body1 = point1;
            contact.body2 = terrain1;
            contact.point = point1.global.body.position;
            contact.velocity = point1.getVelocityAtPosition(contact.point).subtractInPlace(terrain1.getVelocityAtPosition(contact.point));
            if (!manual) {
                this.addContact(contact);
            }
            return contact;
        }
        else {
            var height = terrain1.translateHeightmapToWorld(triangleBottom.getHeight(heightmapPos));
            if (pointPos.y > height.y) {
                //point1.translate(new Vector3(0, height.y - pointPos.y, 0));
            }
        }

        //return true;
        /*
        var height = terrain1.getHeightFromHeightmap(terrain1.heightmaps.top, point1.global.body.position.copy());
        if(height != null){
            if(point1.global.body.position.y < height.y){
                point1.global.body.position = height.copy();
            }
        }
        return true;*/
        return false;
    }

};


export default CollisionDetector;