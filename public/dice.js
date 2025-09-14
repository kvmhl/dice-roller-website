"use strict";

/**
 * @brief generates polyhedral dice with roll animation and result calculation
 * @author Anton Natarov aka Teal (original author)
 * @author Sarah Rosanna Busch (refactor, see changelog)
 * @date 10 Aug 2023
 * @version 2.8
 * @dependencies teal.js, cannon.js, three.js
 */

const DICE = (function() {
    var that = {};

    var vars = {
        frame_rate: 1 / 60,
        scale: 100,
        simulation_speed: 1,

        material_options: {
            specular: 0x172022,
            shininess: 40,
        },
        use_shadows: true,
    }

    const CONSTS = {
        known_types: ['d4', 'd6', 'd8', 'd9', 'd10', 'd12', 'd20', 'd100'],
        dice_face_range: { 'd4': [1, 4], 'd6': [1, 6], 'd8': [1, 8], 'd9': [0, 9], 'd10': [0, 9],
            'd12': [1, 12], 'd20': [1, 20], 'd100': [0, 9] },
        dice_mass: { 'd4': 300, 'd6': 300, 'd8': 340, 'd9': 350, 'd10': 350, 'd12': 350, 'd20': 400, 'd100': 350 },
        dice_inertia: { 'd4': 5, 'd6': 13, 'd8': 10, 'd9': 9, 'd10': 9, 'd12': 8, 'd20': 6, 'd100': 9 },

        labels_1_based: [' ', '1', '2', '3', '4', '5', '6', '7', '8',
            '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'],

        labels_0_based: [' ', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],

        labels_d100: [' ', '00', '10', '20', '30', '40', '50',
            '60', '70', '80', '90'],

        d4_labels: [
            [[], [0, 0, 0], [2, 4, 3], [1, 3, 4], [2, 1, 4], [1, 2, 3]],
            [[], [0, 0, 0], [2, 3, 4], [3, 1, 4], [2, 4, 1], [3, 2, 1]],
            [[], [0, 0, 0], [4, 3, 2], [3, 4, 1], [4, 2, 1], [3, 1, 2]],
            [[], [0, 0, 0], [4, 2, 3], [1, 4, 3], [4, 1, 2], [1, 3, 2]]
        ]
    }

    let normalMap = null;

    function generateNormalMap(width = 256, height = 256) {
        if (normalMap) return normalMap;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        const imageData = context.createImageData(width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const noise = Math.random() * 0.15 + 0.85; // subtle noise
            data[i] = 128;
            data[i + 1] = 128;
            data[i + 2] = 255 * noise;
            data[i + 3] = 255;
        }
        context.putImageData(imageData, 0, 0);
        normalMap = new THREE.CanvasTexture(canvas);
        normalMap.wrapS = THREE.RepeatWrapping;
        normalMap.wrapT = THREE.RepeatWrapping;
        return normalMap;
    }


    that.dice_box = function(container) {
        this.dices = []; this.scene = new THREE.Scene(); this.world = new CANNON.World();
        this.diceToRoll = '1d6';
        this.diceConfiguration = [];
        this.container = container;
        this.barriers = [];
        this.walls = [];
        this.renderer = window.WebGLRenderingContext ? new THREE.WebGLRenderer({ antialias: true, alpha: true }) : new THREE.CanvasRenderer({ antialias: true, alpha: true });

        this.appearance = {
            backgroundColor: '#212121',
            scale: 100
        };

        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.renderer.domElement);
        this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.setClearColor(0xffffff, 0);

        this.world.gravity.set(0, 0, -9.8 * 800);
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 16;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambientLight);
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
        this.scene.add(hemisphereLight);

        this.dice_body_material = new CANNON.Material('diceMaterial');
        let desk_body_material = new CANNON.Material('deskMaterial');
        this.barrier_body_material = new CANNON.Material('barrierMaterial');

        this.world.addContactMaterial(new CANNON.ContactMaterial(desk_body_material, this.dice_body_material, { friction: 0.1, restitution: 0.7 }));
        this.world.addContactMaterial(new CANNON.ContactMaterial(this.barrier_body_material, this.dice_body_material, { friction: 0, restitution: 1.0 }));
        this.world.addContactMaterial(new CANNON.ContactMaterial(this.dice_body_material, this.dice_body_material, { friction: 0.1, restitution: 0.7 }));

        this.world.addBody(new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: desk_body_material }));

        this.reinit(container);
        $t.bind(window, 'resize', () => { this.reinit(container); });

        this.last_time = 0;
        this.running = false;
        this.renderer.render(this.scene, this.camera);
        this.setDice('1d6', [{ type: 'd6', diceColor: '#333333', labelColor: '#FAFAFA' }]);
    };

    that.dice_box.prototype.reinit = function(container) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        const pixelRatio = window.devicePixelRatio || 1;
        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.setSize(width, height);

        const fov_degrees = 30;
        this.aspect = width / height;
        const fov_rad = fov_degrees * Math.PI / 180;
        this.h = height / 2;
        const distance = this.h / Math.tan(fov_rad / 2);

        if (this.camera) this.scene.remove(this.camera);
        this.camera = new THREE.PerspectiveCamera(fov_degrees, this.aspect, 1, distance * 2);
        this.camera.position.z = distance;
        this.w = this.h * this.aspect;
        vars.scale = Math.sqrt(this.w * this.w + this.h * this.h) / 8;

        if (this.light) this.scene.remove(this.light);
        this.light = new THREE.DirectionalLight(0xffffff, 0.8);
        this.light.position.set(-this.w, this.h * 1.5, this.w);
        this.light.target.position.set(0, 0, 0);
        this.light.castShadow = vars.use_shadows;
        this.light.shadow.camera.left = -this.w * 1.5;
        this.light.shadow.camera.right = this.w * 1.5;
        this.light.shadow.camera.top = this.h * 1.5;
        this.light.shadow.camera.bottom = -this.h * 1.5;
        this.light.shadow.camera.near = 1;
        this.light.shadow.camera.far = distance + this.h;
        this.light.shadow.mapSize.width = 2048;
        this.light.shadow.mapSize.height = 2048;
        this.light.shadow.radius = 4;
        this.light.shadow.bias = -0.0001;
        this.scene.add(this.light);
        this.scene.add(this.light.target);

        if (this.desk) this.scene.remove(this.desk);
        this.desk = new THREE.Mesh(new THREE.PlaneGeometry(this.w * 4, this.h * 4, 1, 1),
            new THREE.MeshStandardMaterial({
                color: 0x101010,
                roughness: 0.8,
                metalness: 0.2
            }));
        this.desk.receiveShadow = vars.use_shadows;
        this.scene.add(this.desk);

        if (this.barriers) this.barriers.forEach(b => this.world.removeBody(b));
        this.barriers = [];
        const wall_thickness = 200;
        const wall_height = vars.scale * 30;
        const barrier_body_material = this.barrier_body_material;
        let barrier;

        barrier = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(this.w, wall_thickness, wall_height)), material: barrier_body_material });
        barrier.position.set(0, this.h + wall_thickness, 0);
        this.world.addBody(barrier); this.barriers.push(barrier);

        barrier = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(this.w, wall_thickness, wall_height)), material: barrier_body_material });
        barrier.position.set(0, -this.h - wall_thickness, 0);
        this.world.addBody(barrier); this.barriers.push(barrier);

        barrier = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(wall_thickness, this.h, wall_height)), material: barrier_body_material });
        barrier.position.set(this.w + wall_thickness, 0, 0);
        this.world.addBody(barrier); this.barriers.push(barrier);

        barrier = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(wall_thickness, this.h, wall_height)), material: barrier_body_material });
        barrier.position.set(-this.w - wall_thickness, 0, 0);
        this.world.addBody(barrier); this.barriers.push(barrier);

        this.renderer.render(this.scene, this.camera);
    };

    that.dice_box.prototype.setDice = function(diceToRoll, diceConfig) {
        this.diceToRoll = diceToRoll;
        if (diceConfig) {
            this.diceConfiguration = diceConfig;
        }
        this.updateAppearance(this.appearance);
    };

    that.dice_box.prototype.setSpeed = function(speed) {
        vars.simulation_speed = speed;
    };

    that.dice_box.prototype.applyPhysicsPreset = function(presetName) {
        let gravity = -9.8, restitution = 0.7, friction = 0.1;
        switch (presetName) {
            case "Moon": gravity = -1.6; break;
            case "Jupiter": gravity = -24.8; break;
            case "Ice": friction = 0.0; break;
            case "Bouncy": restitution = 1.1; break;
        }
        this.world.gravity.set(0, 0, gravity * 800);
        if (this.world.contactmaterials.length >= 3) {
            this.world.contactmaterials[0].restitution = restitution;
            this.world.contactmaterials[2].restitution = restitution;
            this.world.contactmaterials[0].friction = friction;
            this.world.contactmaterials[2].friction = friction;
        }
    };

    that.dice_box.prototype.start_throw = function(before_roll, after_roll, optional_vector) {
        if (this.running) return;
        const diceSet = this.diceConfiguration;
        if (diceSet.length === 0) return;
        let serverResults = (typeof before_roll === 'function') ? before_roll() : null;

        const vector = optional_vector || { x: (rnd() * 2 - 1) * this.w, y: -(rnd() * 2 - 1) * this.h };
        const dist = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
        if (dist === 0) return;
        const boost = (rnd() + 3) * dist;
        vector.x /= dist; vector.y /= dist;
        const vectors = this.generate_vectors(diceSet, vector, boost);
        this.roll(vectors, serverResults, after_roll);
    };

    that.dice_box.prototype.playSound = function() {
        const diceCount = this.dices.length;
        if (diceCount === 0) return;
        const soundsToPlay = Math.min(diceCount, 3);
        for (let i = 0; i < soundsToPlay; i++) {
            const audio = new Audio();
            const randsound = Math.floor(Math.random() * 4) + 1;
            audio.src = `assets/dice_rolling${randsound}.mp3`;
            audio.volume = 0.5;
            setTimeout(() => {
                audio.play().catch(e => console.log("Sound play failed:", e));
            }, Math.random() * 200);
        }
    };

    that.dice_box.prototype.generate_vectors = function(diceSet, vector, boost) {
        var vectors = [];
        const num_dice = diceSet.length;
        for (let i = 0; i < num_dice; i++) {
            let pos, velocity, angle;
            if (boost > 0) {
                var vec = make_random_vector(vector);
                pos = {
                    x: this.w * (vec.x > 0 ? -1 : 1) * 0.9,
                    y: this.h * (vec.y > 0 ? -1 : 1) * 0.9,
                    z: rnd() * 200 + 600
                };
                var projector = Math.abs(vec.x / vec.y);
                if (projector > 1.0) pos.y /= projector; else pos.x *= projector;
                var velvec = make_random_vector(vector);
                velocity = { x: velvec.x * boost, y: velvec.y * boost, z: rnd() * 200 + 800  };
                var inertia = CONSTS.dice_inertia[diceSet[i].type];
                angle = { x: -(rnd() * vec.y * 5 + inertia * vec.y), y: rnd() * vec.x * 5 + inertia * vec.x, z: 0 };
            } else {
                if (num_dice <= 1) {
                    pos = { x: 0, y: 0, z: 150 };
                } else {
                    const radius = vars.scale * 1.2 + (num_dice * 8);
                    const angle_step = (2 * Math.PI) / num_dice;
                    const current_angle = i * angle_step;
                    pos = { x: radius * Math.cos(current_angle), y: radius * Math.sin(current_angle), z: 150 + (i * 5) };
                }
                velocity = { x: 0, y: 0, z: 0 };
                angle = { x: 0, y: 0, z: 0 };
            }
            var axis = { x: rnd(), y: rnd(), z: rnd(), a: rnd() };
            vectors.push({ set: diceSet[i], pos: pos, velocity: velocity, angle: angle, axis: axis });
        }
        return vectors;
    };

    that.dice_box.prototype.create_dice = function(dieObject, pos, velocity, angle, axis) {
        const type = dieObject.type;
        var dice = threeD_dice['create_' + type](dieObject);
        dice.castShadow = true;
        dice.dice_type = type;
        dice.body = new CANNON.Body({
            mass: CONSTS.dice_mass[type],
            shape: dice.geometry.cannon_shape,
            material: this.dice_body_material
        });
        dice.body.position.set(pos.x, pos.y, pos.z);
        dice.position.copy(dice.body.position);
        dice.body.quaternion.setFromAxisAngle(new CANNON.Vec3(axis.x, axis.y, axis.z), axis.a * Math.PI * 2);
        dice.body.angularVelocity.set(angle.x, angle.y, angle.z);
        dice.body.velocity.set(velocity.x, velocity.y, velocity.z);
        dice.body.linearDamping = 0.1;
        dice.body.angularDamping = 0.1;
        this.scene.add(dice);
        this.dices.push(dice);
        this.world.addBody(dice.body);
    }

    that.dice_box.prototype.check_if_throw_finished = function() {
        var res = true;
        var e = 6;
        if (this.iteration < 10 / (vars.frame_rate * vars.simulation_speed)) {
            for (var i = 0; i < this.dices.length; ++i) {
                var dice = this.dices[i];
                if (dice.dice_stopped === true) continue;
                var a = dice.body.angularVelocity, v = dice.body.velocity;
                if (Math.abs(a.x) < e && Math.abs(a.y) < e && Math.abs(a.z) < e &&
                    Math.abs(v.x) < e && Math.abs(v.y) < e && Math.abs(v.z) < e) {
                    if (dice.dice_stopped) {
                        if (this.iteration - dice.dice_stopped > 3) {
                            dice.dice_stopped = true;
                            continue;
                        }
                    }
                    else dice.dice_stopped = this.iteration;
                    res = false;
                }
                else {
                    dice.dice_stopped = undefined;
                    res = false;
                }
            }
        }
        return res;
    };

    that.dice_box.prototype.emulate_throw = function() {
        while (!this.check_if_throw_finished()) {
            ++this.iteration;
            this.world.step(vars.frame_rate * vars.simulation_speed);
        }
        return get_dice_values(this.dices);
    }

    that.dice_box.prototype.__animate = function(threadid) {
        const time = (new Date()).getTime();
        let time_diff = (time - this.last_time) / 1000;
        if (time_diff > 3) time_diff = vars.frame_rate;
        ++this.iteration;
        this.world.step(vars.frame_rate * vars.simulation_speed);
        for (var i in this.scene.children) {
            var interact = this.scene.children[i];
            if (interact.body !== undefined) {
                interact.position.copy(interact.body.position);
                interact.quaternion.copy(interact.body.quaternion);
            }
        }
        this.renderer.render(this.scene, this.camera);
        this.last_time = time;
        if (this.running == threadid && this.check_if_throw_finished()) {
            this.running = false;
            const physicalResults = get_dice_values(this.dices);
            const serverResults = this.predetermined_results;
            if (serverResults && serverResults.length) {
                for (let i = 0; i < this.dices.length; i++) {
                    shift_dice_faces(this.dices[i], serverResults[i], physicalResults[i]);
                }
            }
            const finalNotation = that.parse_notation(this.diceToRoll);
            finalNotation.result = serverResults || physicalResults;
            finalNotation.resultTotal = finalNotation.result.reduce((s, a) => s + a, 0) + finalNotation.constant;
            finalNotation.resultString = finalNotation.result.join(' + ');
            if (finalNotation.constant !== 0) finalNotation.resultString += (finalNotation.constant > 0 ? ' + ' : ' ') + finalNotation.constant;
            if (finalNotation.result.length > 1 || finalNotation.constant !== 0) finalNotation.resultString += ` = ${finalNotation.resultTotal}`;
            if (this.callback) {
                this.callback(finalNotation);
            }
        }
        if (this.running == threadid) {
            (function(t, tid) {
                requestAnimationFrame(function() { t.__animate(tid); });
            })(this, threadid);
        }
    };

    that.dice_box.prototype.clear = function() {
        this.running = false;
        var dice;
        while (dice = this.dices.pop()) {
            this.scene.remove(dice);
            if (dice.body) this.world.removeBody(dice.body);
        }
        if (this.pane) this.scene.remove(this.pane);
        this.renderer.render(this.scene, this.camera);
        var box = this;
        setTimeout(function() { box.renderer.render(box.scene, box.camera); }, 100);
    }

    that.dice_box.prototype.prepare_dices_for_roll = function(vectors) {
        this.clear();
        this.iteration = 0;
        for (var i in vectors) {
            this.create_dice(vectors[i].set, vectors[i].pos, vectors[i].velocity,
                vectors[i].angle, vectors[i].axis);
        }
    };

    that.dice_box.prototype.roll = function(vectors, values, callback) {
        this.clear();
        this.prepare_dices_for_roll(vectors);
        if (values != undefined && values.length) {
            this.predetermined_results = values;
            var res = this.emulate_throw();
            this.prepare_dices_for_roll(vectors);
            for (var i in res) {
                shift_dice_faces(this.dices[i], values[i], res[i]);
            }
        } else {
            this.predetermined_results = null;
        }
        this.callback = callback;
        this.running = (new Date()).getTime();
        this.last_time = 0;
        this.__animate(this.running);
    };

    let threeD_dice = {};

    that.dice_box.prototype.updateAppearance = function(options) {

        this.appearance = { ...this.appearance, ...options };
        const textureLoader = new THREE.TextureLoader();

        const applyTexture = (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;


            texture.repeat.set(2.0, 2.0);

            texture.offset.set(-0.5, -0.5);

            this.desk.material.map = texture;
            this.desk.material.color.set(0xffffff);
            this.desk.material.needsUpdate = true;
            this.renderer.render(this.scene, this.camera);
        };

        if (this.appearance.useAchillBackground) {
            // Lade das Standard-Hintergrundbild (.png wie gewünscht)
            textureLoader.load('/assets/achill_background.png', applyTexture, undefined,
                function (err) { console.error('Error loading default background:', err); }
            );
        }
        else if (this.appearance.backgroundImage) {
            // Lade ein benutzerdefiniertes Hintergrundbild
            textureLoader.load(this.appearance.backgroundImage, applyTexture, undefined,
                function (err) { console.error('Error loading custom background:', err); }
            );
        }
        else {
            // Benutze eine Hintergrundfarbe
            if (this.desk.material.map) this.desk.material.map = null;
            this.desk.material.color.set(this.appearance.backgroundColor || '#212121');
            this.desk.material.needsUpdate = true;
        }

        if (this.appearance.scale) {
            vars.scale = this.appearance.scale;
            Object.keys(threeD_dice).forEach(key => {
                if (key.endsWith('_geometry')) {
                    threeD_dice[key] = null;
                }
            });
        }

        this.clear();
        const vectors = this.generate_vectors(this.diceConfiguration, { x: 0, y: 0 }, 0);
        this.prepare_dices_for_roll(vectors);
        this.renderer.render(this.scene, this.camera);
    };
    // =================================================================================
    // ==                          END: REVISED CODE BLOCK                          ==
    // =================================================================================


    that.parse_notation = function(notation) {
        var no = notation.split('@');
        var dr0 = /\s*(\d*)([a-z]+)(\d+)(\s*(\+|\-)\s*(\d+)){0,1}\s*(\+|$)/gi;
        var dr1 = /(\b)*(\d+)(\b)*/gi;
        var ret = { set: [], constant: 0, result: [], resultTotal: 0, resultString: '', error: false };
        var res;
        while (res = dr0.exec(no[0])) {
            var command = res[2];
            if (command != 'd') { ret.error = true; continue; }
            var count = parseInt(res[1]);
            if (res[1] == '') count = 1;
            var type = 'd' + res[3];
            if (CONSTS.known_types.indexOf(type) == -1) { ret.error = true; continue; }
            while (count--) ret.set.push(type);
            if (res[5] && res[6]) {
                if (res[5] == '+') ret.constant += parseInt(res[6]);
                else ret.constant -= parseInt(res[6]);
            }
        }
        while (res = dr1.exec(no[1])) {
            ret.result.push(parseInt(res[2]));
        }
        return ret;
    }

    // DICE MODELS
    threeD_dice.create_d4 = function(die) {
        if (!this.d4_geometry) this.d4_geometry = create_d4_geometry(vars.scale * 1.2);
        const materials = create_d4_materials(vars.scale / 2, vars.scale * 2, CONSTS.d4_labels[0], die);
        return new THREE.Mesh(this.d4_geometry, materials);
    };
    threeD_dice.create_d6 = function(die) {
        if (!this.d6_geometry) this.d6_geometry = create_d6_geometry(vars.scale * 1.0);
        return new THREE.Mesh(this.d6_geometry, create_dice_materials(CONSTS.labels_1_based, vars.scale / 2, 0.9, die));
    };
    threeD_dice.create_d8 = function(die) {
        if (!this.d8_geometry) this.d8_geometry = create_d8_geometry(vars.scale);
        return new THREE.Mesh(this.d8_geometry, create_dice_materials(CONSTS.labels_1_based, vars.scale / 2, 1.4, die));
    };
    threeD_dice.create_d10 = function(die) {
        if (!this.d10_geometry) this.d10_geometry = create_d10_geometry(vars.scale * 0.9);
        return new THREE.Mesh(this.d10_geometry, create_dice_materials(CONSTS.labels_0_based, vars.scale / 2, 1.0, die));
    };
    threeD_dice.create_d9 = threeD_dice.create_d10;
    threeD_dice.create_d12 = function(die) {
        if (!this.d12_geometry) this.d12_geometry = create_d12_geometry(vars.scale * 0.9);
        return new THREE.Mesh(this.d12_geometry, create_dice_materials(CONSTS.labels_1_based, vars.scale / 2, 1.0, die));
    };
    threeD_dice.create_d20 = function(die) {
        if (!this.d20_geometry) this.d20_geometry = create_d20_geometry(vars.scale);
        return new THREE.Mesh(this.d20_geometry, create_dice_materials(CONSTS.labels_1_based, vars.scale / 2, 1.2, die));
    };
    threeD_dice.create_d100 = function(die) {
        if (!this.d10_geometry) this.d10_geometry = create_d10_geometry(vars.scale * 0.9);
        return new THREE.Mesh(this.d10_geometry, create_dice_materials(CONSTS.labels_d100, vars.scale / 2, 1.5, die));
    };

    // MATERIALS & TEXTURES
    function create_dice_materials(face_labels, size, margin, die) {
        function create_text_texture(text, color, back_color) {
            if (text == undefined) return null;
            var canvas = document.createElement("canvas");
            var context = canvas.getContext("2d");
            var ts = Math.max(calc_texture_size(size + size * 2 * margin) * 2, 256);
            canvas.width = canvas.height = ts;
            context.font = ts / (1 + 2 * margin) + "pt Arial";
            context.fillStyle = back_color;
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillStyle = color;
            context.fillText(text, canvas.width / 2, canvas.height / 2);
            if (text == '6' || text == '9') {
                context.fillText('  .', canvas.width / 2, canvas.height / 2);
            }
            var texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            return texture;
        }

        var materials = [];
        for (var i = 0; i < face_labels.length; ++i) {
            materials.push(new THREE.MeshStandardMaterial({
                map: create_text_texture(face_labels[i], die.labelColor, die.diceColor),
                color: die.diceColor,
                metalness: die.metalness,
                roughness: die.roughness,
                normalMap: generateNormalMap(),
            }));
        }
        return materials;
    }

    function create_d4_materials(size, margin, labels, die) {
        function create_d4_text(text, color, back_color) {
            var canvas = document.createElement("canvas");
            var context = canvas.getContext("2d");
            var ts = calc_texture_size(size + margin) * 2;
            canvas.width = canvas.height = ts;
            context.font = (ts - margin) * 0.5 + "pt Arial";
            context.fillStyle = back_color;
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillStyle = color;
            for (var i in text) {
                context.fillText(text[i], canvas.width / 2, canvas.height / 2 - ts * 0.3);
                context.translate(canvas.width / 2, canvas.height / 2);
                context.rotate(Math.PI * 2 / 3);
                context.translate(-canvas.width / 2, -canvas.height / 2);
            }
            var texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            return texture;
        }

        var materials = [];
        for (var i = 0; i < labels.length; ++i) {
            materials.push(new THREE.MeshStandardMaterial({
                map: create_d4_text(labels[i], die.labelColor, die.diceColor),
                color: die.diceColor,
                metalness: die.metalness,
                roughness: die.roughness,
                normalMap: generateNormalMap(),
            }));
        }
        return materials;
    }

    // GEOMETRY FUNCTIONS
    function create_d4_geometry(radius) {
        var vertices = [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]];
        var faces = [[1, 0, 2, 1], [0, 1, 3, 2], [0, 3, 2, 3], [1, 2, 3, 4]];
        return create_geom(vertices, faces, radius, -0.1, Math.PI * 7 / 6);
    }

    function create_d6_geometry(radius) {
        var vertices = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
            [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
        var faces = [[0, 3, 2, 1, 1], [1, 2, 6, 5, 2], [0, 1, 5, 4, 3],
            [3, 7, 6, 2, 4], [0, 4, 7, 3, 5], [4, 5, 6, 7, 6]];
        return create_geom(vertices, faces, radius, 0.1, Math.PI / 4);
    }

    function create_d8_geometry(radius) {
        var vertices = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
        var faces = [[0, 2, 4, 1], [0, 4, 3, 2], [0, 3, 5, 3], [0, 5, 2, 4], [1, 3, 4, 5],
            [1, 4, 2, 6], [1, 2, 5, 7], [1, 5, 3, 8]];
        return create_geom(vertices, faces, radius, 0, -Math.PI / 4 / 2);
    }

    function create_d10_geometry(radius) {
        var a = Math.PI * 2 / 10;
        var vertices = [];
        for (var i = 0, b = 0; i < 10; ++i, b += a)
            vertices.push([Math.cos(b), Math.sin(b), 0.105 * (i % 2 ? 1 : -1)]);
        vertices.push([0, 0, -1]);
        vertices.push([0, 0, 1]);

        var faces = [
            [5, 7, 11, 2], [4, 2, 10, 3], [1, 3, 11, 4], [0, 8, 10, 5], [7, 9, 11, 6],
            [8, 6, 10, 7], [9, 1, 11, 8], [2, 0, 10, 9], [3, 5, 11, 10], [6, 4, 10, 1],
            [1, 0, 2, 0], [1, 2, 3, 0], [3, 2, 4, 0], [3, 4, 5, 0], [5, 4, 6, 0],
            [5, 6, 7, 0], [7, 6, 8, 0], [7, 8, 9, 0], [9, 8, 0, 0], [9, 0, 1, 0]
        ];

        return create_geom(vertices, faces, radius, 0, Math.PI * 6 / 5);
    }

    function create_d12_geometry(radius) {
        var p = (1 + Math.sqrt(5)) / 2, q = 1 / p;
        var vertices = [[0, q, p], [0, q, -p], [0, -q, p], [0, -q, -p], [p, 0, q],
            [p, 0, -q], [-p, 0, q], [-p, 0, -q], [q, p, 0], [q, -p, 0], [-q, p, 0],
            [-q, -p, 0], [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1],
            [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]];
        var faces = [[2, 14, 4, 12, 0, 1], [15, 9, 11, 19, 3, 2], [16, 10, 17, 7, 6, 3], [6, 7, 19, 11, 18, 4],
            [6, 18, 2, 0, 16, 5], [18, 11, 9, 14, 2, 6], [1, 17, 10, 8, 13, 7], [1, 13, 5, 15, 3, 8],
            [13, 8, 12, 4, 5, 9], [5, 4, 14, 9, 15, 10], [0, 12, 8, 10, 16, 11], [3, 19, 7, 17, 1, 12]];
        return create_geom(vertices, faces, radius, 0.2, -Math.PI / 4 / 2);
    }

    function create_d20_geometry(radius) {
        var t = (1 + Math.sqrt(5)) / 2;
        var vertices = [[-1, t, 0], [1, t, 0 ], [-1, -t, 0], [1, -t, 0],
            [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
            [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
        var faces = [[0, 11, 5, 1], [0, 5, 1, 2], [0, 1, 7, 3], [0, 7, 10, 4], [0, 10, 11, 5],
            [1, 5, 9, 6], [5, 11, 4, 7], [11, 10, 2, 8], [10, 7, 6, 9], [7, 1, 8, 10],
            [3, 9, 4, 11], [3, 4, 2, 12], [3, 2, 6, 13], [3, 6, 8, 14], [3, 8, 9, 15],
            [4, 9, 5, 16], [2, 4, 11, 17], [6, 2, 10, 18], [8, 6, 7, 19], [9, 8, 1, 20]];
        return create_geom(vertices, faces, radius, -0.2, -Math.PI / 4 / 2);
    }

    // HELPER FUNCTIONS
    function rnd() { return Math.random(); }

    function create_shape(vertices, faces, radius) {
        const cannon_vertices = vertices.map(v => new CANNON.Vec3(v.x * radius, v.y * radius, v.z * radius));
        const cannon_faces = faces.map(f => f.slice(0, f.length - 1));
        return new CANNON.ConvexPolyhedron(cannon_vertices, cannon_faces);
    }

    function make_geom(vertices, faces, radius, tab, af) {
        const geom = new THREE.BufferGeometry();
        const positions = [];
        const uvs = [];
        geom.userData.faceNormals = [];
        geom.userData.triangleMaterialIndices = [];

        const scaledVertices = vertices.map(v => v.clone().multiplyScalar(radius));
        let vertexIndex = 0;
        const tri = new THREE.Triangle();

        for (let i = 0; i < faces.length; ++i) {
            const face = faces[i];
            const fl = face.length - 1;
            const materialIndex = face[fl];
            const aa = Math.PI * 2 / fl;
            const numTriangles = fl - 2;

            geom.addGroup(vertexIndex, numTriangles * 3, materialIndex);

            for (let j = 0; j < numTriangles; ++j) {
                const v1 = scaledVertices[face[0]];
                const v2 = scaledVertices[face[j + 1]];
                const v3 = scaledVertices[face[j + 2]];
                positions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);

                tri.set(v1, v2, v3);
                const normal = new THREE.Vector3();
                tri.getNormal(normal);
                geom.userData.faceNormals.push(normal);
                geom.userData.triangleMaterialIndices.push(materialIndex);

                const uv_map = [0, j + 1, j + 2];
                uv_map.forEach(map_index => {
                    const angle = aa * map_index + af;
                    uvs.push((Math.cos(angle) + 1 + tab) / 2 / (1 + tab), (Math.sin(angle) + 1 + tab) / 2 / (1 + tab));
                });
                vertexIndex += 3;
            }
        }

        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geom.computeVertexNormals();
        geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius);
        return geom;
    }

    function create_geom(vertices, faces, radius, tab, af) {
        var vectors = vertices.map(v => (new THREE.Vector3).fromArray(v).normalize());
        var geom = make_geom(vectors, faces, radius, tab, af);
        geom.cannon_shape = create_shape(vectors, faces, radius);
        return geom;
    }

    function calc_texture_size(approx) {
        return Math.pow(2, Math.floor(Math.log(approx) / Math.log(2)));
    }

    function make_random_vector(vector) {
        var random_angle = rnd() * Math.PI / 5 - Math.PI / 5 / 2;
        var vec = {
            x: vector.x * Math.cos(random_angle) - vector.y * Math.sin(random_angle),
            y: vector.x * Math.sin(random_angle) + vector.y * Math.cos(random_angle)
        };
        if (vec.x == 0) vec.x = 0.01;
        if (vec.y == 0) vec.y = 0.01;
        return vec;
    }

    function get_dice_value(dice) {
        const vector = new THREE.Vector3(0, 0, dice.dice_type === 'd4' ? -1 : 1);
        let closest_triangle_index = -1;
        let closest_angle = Math.PI * 2;
        const normals = dice.geometry.userData.faceNormals;
        const materialIndices = dice.geometry.userData.triangleMaterialIndices;

        for (let i = 0; i < normals.length; ++i) {
            if (materialIndices[i] === 0) continue;
            const angle = normals[i].clone().applyQuaternion(dice.body.quaternion).angleTo(vector);
            if (angle < closest_angle) {
                closest_angle = angle;
                closest_triangle_index = i;
            }
        }

        let matindex = closest_triangle_index !== -1 ? materialIndices[closest_triangle_index] : 0;
        if (matindex === 0) return -1;

        let value;
        const type = dice.dice_type;

        if (['d4', 'd6', 'd8', 'd12', 'd20'].includes(type)) {
            value = matindex;
        } else {
            value = matindex - 1;
        }

        if (type === 'd100') value *= 10;
        if (type === 'd10' && value === 0) value = 10;

        return value;
    }

    function get_dice_values(dices) {
        var values = [];
        for (var i = 0, l = dices.length; i < l; ++i) {
            values.push(get_dice_value(dices[i]));
        }
        return values;
    }

    function shift_dice_faces(dice, value, res) {
        const r = CONSTS.dice_face_range[dice.dice_type];
        if (dice.dice_type === 'd10' && value === 10) value = 0;
        if (!(value >= r[0] && value <= r[1])) return;
        const num = value - res;
        if (num === 0) return;

        if (dice.dice_type === 'd4') {
            let new_label_index = num;
            if (new_label_index < 0) new_label_index += 4;
            dice.material = create_d4_materials(
                vars.scale / 2, vars.scale * 2, CONSTS.d4_labels[new_label_index],
                dice.appearance.diceColors.d4, dice.appearance.labelColors.d4
            );
        } else {
            const geom = dice.geometry;
            const is_1_based = ['d4', 'd6', 'd8', 'd12', 'd20'].includes(dice.dice_type);

            for (const group of geom.groups) {
                let matindex = group.materialIndex;
                if (matindex === 0) continue;

                matindex += num;

                if (is_1_based) {
                    while (matindex > r[1]) matindex -= r[1];
                    while (matindex < r[0]) matindex += r[1];
                } else { // 0-based
                    while (matindex > r[1]) matindex -= (r[1] + 1);
                    while (matindex < r[0]) matindex += (r[1] + 1);
                }

                group.materialIndex = matindex;
            }
        }
    }

    return that;
}());

