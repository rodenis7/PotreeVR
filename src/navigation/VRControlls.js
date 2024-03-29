export class VRControlls{

	constructor(viewer){

		this.a=0;
		
		this.viewer = viewer;

		this.previousPads = [];

		this.selection = [];

		this.triggerStarts = [];

		this.scaleState = null;

		this.selectionBox = this.createBox();
		this.viewer.scene.scene.add(this.selectionBox);

		this.snLeft = this.createControllerModel();
		this.snRight = this.createControllerModel();
					
		this.viewer.scene.scene.add(this.snLeft.node);
		this.viewer.scene.scene.add(this.snRight.node);
		
		

	}

	createControllerModel(){
		const geometry = new THREE.SphereGeometry(1, 32, 32);
		const material = new THREE.MeshLambertMaterial( { color: 0xff0000, side: THREE.DoubleSide, flatShading: true } );
		const node = new THREE.Mesh(geometry, material);

		node.position.set(0, 0, 0.5);
		node.scale.set(0.02, 0.02, 0.02);
		node.visible = false;

		viewer.scene.scene.add(node);

		const controller = {
			node: node,
		};
		//viewer.scene.scene.add(node);

		return controller;
	}
	
	createBox(){
		const color = 0xffff00;

		const indices = new Uint16Array( [ 0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7 ] );
		const positions = [ 
			1, 1, 1,
			0, 1, 1,
			0, 0, 1,
			1, 0, 1,
			1, 1, 0,
			0, 1, 0,
			0, 0, 0,
			1, 0, 0
		];
		const geometry = new THREE.BufferGeometry();

		geometry.setIndex( new THREE.BufferAttribute( indices, 1 ) );
		geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );

		geometry.computeBoundingSphere();

		const mesh = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial( { color: color } ) );
		mesh.visible = false;

		return mesh;
	}

	debugLine(start, end, index, color){

		if(typeof this.debugLines === "undefined"){

			const geometry = new THREE.SphereGeometry(1, 8, 8);

			this.debugLines = {
				geometry: geometry,
			};
		}

		const n = 100;

		if(!this.debugLines[index]){
			const geometry = this.debugLines.geometry;
			const material = new THREE.MeshBasicMaterial({color: color});
			const nodes = [];

			for(let i = 0; i <= n; i++){
				const u = i / n;

				const node = new THREE.Mesh(geometry, material);

				const position = new THREE.Vector3().addVectors(
					start.clone().multiplyScalar(1-u),
					end.clone().multiplyScalar(u)
				);

				node.position.copy(position);
				node.scale.set(0.002, 0.002, 0.002);
				this.viewer.scene.scene.add(node);
				nodes.push(node);
			}

			const debugLine = {
				material: material,
				nodes: nodes,
			};

			this.debugLines[index] = debugLine;
		}else{
			const debugLine = this.debugLines[index];

			for(let i = 0; i <= n; i++){
				const node = debugLine.nodes[i];
				const u = i / n;

				const position = new THREE.Vector3().addVectors(
					start.clone().multiplyScalar(1-u),
					end.clone().multiplyScalar(u)
				);

				node.position.copy(position);
			}
		}


	}

	getPointcloudsAt(pointclouds, position){

		const I = [];
		for(const pointcloud of pointclouds){

			const world = pointcloud.matrixWorld;
			const worldToObject = new THREE.Matrix4().getInverse(world);

			const center = position.clone();
			const radius = 0.01;
			//const radius = node.scale.x;
			const sphere = new THREE.Sphere(center, radius);
			sphere.applyMatrix4(worldToObject);

			const box = pointcloud.boundingBox;
			const intersects = box.intersectsSphere(sphere);

			if(intersects){
				I.push(pointcloud);
			}
		}

		return I;
	}

	copyPad(pad){
		const buttons = pad.buttons.map(b => {return {touched: b.touched,pressed: b.pressed}});

		const pose = {
			position: new Float32Array(pad.pose.position),
		};

		const copy = {
			buttons: buttons,
			pose: pose, 
			hand: pad.hand,
			index: pad.index,
		};

		return copy;
	}

	previousPad(gamepad){
		return this.previousPads.find(c => c.index === gamepad.index);
	}

	update(){
		
		this.a++;
		const {selection, viewer, snLeft, snRight} = this;
		const vr = viewer.vr;

		const vrActive = vr && vr.display.isPresenting;

		snLeft.node.visible = vrActive;
		snRight.node.visible = vrActive;

		if(!vrActive){

			return;
		}

		const pointclouds = viewer.scene.pointclouds;

		
		const gamepads = Array.from(navigator.getGamepads()).filter(p => p !== null).map(this.copyPad);
		/*		
		if (this.a%500==0){
			console.log(gamepads);
		}
		*/
		const getPad = (list, pattern) => list.find(pad => pad.index === pattern.index);
		
		if(this.previousPads.length !== gamepads.length){
			this.previousPads = gamepads;
		}

		const left = gamepads.find(gp => gp.hand && gp.hand === "left");
		const right = gamepads.find(gp => gp.hand && gp.hand === "right");
		
		const triggered = gamepads.filter(gamepad => {
			return gamepad.buttons[1].pressed;
		});	
			
		const justTriggered = triggered.filter(gamepad => {
			const prev = this.previousPad(gamepad);
			const previouslyTriggered = prev.buttons[1].pressed;
			const currentlyTriggered = gamepad.buttons[1].pressed;
			return !previouslyTriggered && currentlyTriggered;
		});

		const justUntriggered = gamepads.filter(gamepad => {
			const prev = this.previousPad(gamepad);
			const previouslyTriggered = prev.buttons[1].pressed;
			const currentlyTriggered = gamepad.buttons[1].pressed;

			return previouslyTriggered && !currentlyTriggered;
		});

		const toScene = (position) => {
			return new THREE.Vector3(position.x, -position.z, position.y);
		};
		
		if(triggered.length === 0){
			const positions = gamepads.map(pad => toScene(new THREE.Vector3(...pad.pose.position)));

			const hovered = new Set();
			for(const position of positions){
				const I = this.getPointcloudsAt(pointclouds, position);
				for(let pc of I){
					hovered.add(pc);
				}
			}

			if(hovered.size > 0){
				const pointcloud = Array.from(hovered)[0];
				this.selectionBox.visible = true;
				this.selectionBox.scale.copy(pointcloud.boundingBox.max).multiply(pointcloud.scale);
				this.selectionBox.position.copy(pointcloud.position);
				this.selectionBox.rotation.copy(pointcloud.rotation);
				//this.selectionBox.scale.copy(pointcloud.scale);
			}else{
				this.selectionBox.visible = false;
			}
		}else{
			if(selection.length > 0){
				const pointcloud = selection[0];
				this.selectionBox.scale.copy(pointcloud.boundingBox.max).multiply(pointcloud.scale);
				this.selectionBox.position.copy(pointcloud.position);
				this.selectionBox.rotation.copy(pointcloud.rotation);
			}
		}

		if(justTriggered.length > 0){
			console.log(triggered);
			const pad = justTriggered[0];
			const position = toScene(new THREE.Vector3(...pad.pose.position));
			const I = this.getPointcloudsAt(pointclouds, position);

			const pcs = I.map(p => {
				return {
					node: p,
					position: p.position.clone(),
					rotation: p.rotation.clone(),
					scale: p.scale.clone(),
				};
			});

			const event = {
				pad: pad,
				pointclouds: pcs,
			};

			this.triggerStarts.push(event);
		}

		if(justUntriggered.length > 0){
			for(let untriggeredPad of justUntriggered){
				const p = getPad(this.triggerStarts.map(t => t.pad), untriggeredPad);
				this.triggerStarts = this.triggerStarts.filter(e => e.pad !== p);
			}
		}

		if(triggered.length === 0){
			selection.length = 0;
			this.triggerStarts = [];
		}

		if(justTriggered.length === 1 && triggered.length === 1){
			// one controller was triggered this frame
			const pad = justTriggered[0];
			const position = toScene(new THREE.Vector3(...pad.pose.position));
			const I = this.getPointcloudsAt(pointclouds, position);
			
			if(I.length > 0){
				selection.length = 0;
				selection.push(I[0]);
			}
		}else if(justTriggered.length === 2 && triggered.length === 2){
			// two controllers were triggered this frame
			const pad = justTriggered[0];
			const position = toScene(new THREE.Vector3(...pad.pose.position));
			const I = this.getPointcloudsAt(pointclouds, position);
			
			if(I.length > 0){
				selection.length = 0;
				selection.push(I[0]);
			}
		}

		if(justTriggered.length > 0 && triggered.length === 2){
			// START SCALE/ROTATE

			const pcs = selection.map(p => ({
				node: p,
				position: p.position.clone(),
				rotation: p.rotation.clone(),
				scale: p.scale.clone(),
			}));

			this.scaleState = {
				first: triggered[0],
				second: triggered[1],
				pointclouds: pcs,
			};
		}else if(triggered.length < 2){
			// STOP SCALE/ROTATE
			this.scaleState = null;
		}
		
		if(this.scaleState){
			// SCALE/ROTATE

			const {first, second, pointclouds} = this.scaleState;

			if(pointclouds.length > 0){
				
				const pointcloud = pointclouds[0];
				
				const p1Start = toScene(new THREE.Vector3(...first.pose.position));
				const p2Start = toScene(new THREE.Vector3(...second.pose.position));

				const p1End = toScene(new THREE.Vector3(...getPad(gamepads, first).pose.position));
				const p2End = toScene(new THREE.Vector3(...getPad(gamepads, second).pose.position));

				const diffStart = new THREE.Vector3().subVectors(p2Start, p1Start);
				const diffEnd = new THREE.Vector3().subVectors(p2End, p1End);

				// this.debugLine(p1Start, p2Start, 0, 0xFF0000);
				// this.debugLine(p1End, p2End, 1, 0x00FF00);

				// ROTATION
				const diffStartG = new THREE.Vector3(diffStart.x, diffStart.y, 0);
				const diffEndG = new THREE.Vector3(diffEnd.x, diffEnd.y, 0);
				let sign = Math.sign(diffStartG.clone().cross(diffEndG).z);
				sign = sign === 0 ? 1 : sign;
				const angle = sign * diffStartG.angleTo(diffEndG);
				const newAngle = pointcloud.rotation.z + angle;
				
				// SCALE
				const scale = diffEnd.length() / diffStart.length();
				const newScale = pointcloud.scale.clone().multiplyScalar(scale);

				// POSITION
				const p1ToP = new THREE.Vector3().subVectors(pointcloud.position, p1Start);
				p1ToP.multiplyScalar(scale);
				p1ToP.applyAxisAngle(new THREE.Vector3(0, 0, 1), angle);
				const newPosition = p1End.clone().add(p1ToP);
				
				//this.debugLine(pointcloud.position, newPosition, 0, 0xFF0000);

				//console.log(newScale, p1ToP, angle);

				pointcloud.node.rotation.z = newAngle;
				pointcloud.node.scale.copy(newScale);
				pointcloud.node.position.copy(newPosition);

				pointcloud.node.updateMatrix();
				pointcloud.node.updateMatrixWorld();



			}

		}
		
		if(triggered.length === 1){
			// TRANSLATE 
			const pad = triggered[0];
			const prev = this.previousPad(pad);

			const diff = toScene(new THREE.Vector3(
				pad.pose.position[0] - prev.pose.position[0],
				pad.pose.position[1] - prev.pose.position[1],
				pad.pose.position[2] - prev.pose.position[2],
			));

			for(const pc of selection){
				pc.position.add(diff);
			}
		}

		{ // MOVE CONTROLLER SCENE NODE
			if(right){
				const {node, debug} = snLeft;
				const position = toScene(new THREE.Vector3(...right.pose.position));
				node.position.copy(position);
			}
			
			if(left){
				const {node, debug} = snRight;
				
				const position = toScene(new THREE.Vector3(...left.pose.position));
				node.position.copy(position);
			}
		}

		this.previousPads = gamepads;
	}
};