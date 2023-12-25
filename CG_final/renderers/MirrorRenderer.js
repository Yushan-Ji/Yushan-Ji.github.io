
/**
 * MirrorRenderer：一个three.js对象，继承自Object3D
 */

THREE.MirrorRenderer = function (renderer, camera, scene, options) {
	
	THREE.Object3D.call(this);
	this.name = 'mirror_' + this.id;

	// 处理可选参数，若没有参数值则使用defaultvalue
	function optionalParameter (value, defaultValue) {
		return value !== undefined ? value : defaultValue;
	};

	// 若没有options参数则设置为空对象
	options = options || {};
	
	this.matrixNeedsUpdate = true;
	
	// 变量初始化
	var width = optionalParameter(options.textureWidth, 512);
	var height = optionalParameter(options.textureHeight, 512);
	this.clipBias = optionalParameter(options.clipBias, 0.0);
	
	this.renderer = renderer;
	this.scene = scene;
	this.mirrorPlane = new THREE.Plane();
	this.normal = new THREE.Vector3(0, 0, 1);
	this.cameraWorldPosition = new THREE.Vector3();
	this.rotationMatrix = new THREE.Matrix4();
	this.lookAtPosition = new THREE.Vector3(0, 0, -1);
	this.clipPlane = new THREE.Vector4();
	
	// 使用透视相机（若没有则创建一个透视相机）
	if ( camera instanceof THREE.PerspectiveCamera ) {
		this.camera = camera;
	}
	else  {
		this.camera = new THREE.PerspectiveCamera();
	}

	// 
	this.textureMatrix = new THREE.Matrix4();

	this.mirrorCamera = this.camera.clone();
	
	this.mesh = new THREE.Object3D();
	
	this.texture = new THREE.WebGLRenderTarget(width, height);
	this.tempTexture = new THREE.WebGLRenderTarget(width, height);
	
	if ( !THREE.Math.isPowerOfTwo(width) || !THREE.Math.isPowerOfTwo(height) ) {
		this.texture.generateMipmaps = false;
		this.tempTexture.generateMipmaps = false;
	}

	this.updateTextureMatrix();
	this.render();
};
// 实现继承关系
THREE.MirrorRenderer.prototype = Object.create(THREE.Object3D.prototype);


/**
 * updateTextureMatrix：更新矩阵纹理参数
 */
THREE.MirrorRenderer.prototype.updateTextureMatrix = function () {

	if ( this.parent != undefined ) {
		this.mesh = this.parent;
	}

	// sign函数，返回数字符号
	function sign(x) { return x ? x < 0 ? -1 : 1 : 0; }

	// 更新当前对象的世界矩阵
	this.updateMatrixWorld();
	// 更新当前相机的世界矩阵
	this.camera.updateMatrixWorld();

	// 获取相机在世界坐标系中的位置
	this.cameraWorldPosition.setFromMatrixPosition(this.camera.matrixWorld);

	// 提取旋转矩阵
	this.rotationMatrix.extractRotation(this.matrixWorld);

	// 初始化法向量normal，表示镜面的法向量
	// 更具mesh对象的旋转来确定法向量方向
	this.normal = (new THREE.Vector3(0, 1, 0)).applyEuler(this.mesh.rotation);

	// 相机视线方向，根据相机旋转来确定视线方向
	var cameraLookAt = (new THREE.Vector3(0, 0, 1)).applyEuler(this.camera.rotation);
	
	// 如果法向量和视线方向的点积小于零，表示相机的视线方向和法向量方向相反，需要调整法向量的方向
	if (this.normal.dot(cameraLookAt) < 0) {
		var meshNormal = (new THREE.Vector3(0, 0, 1)).applyEuler(this.mesh.rotation);
		this.normal.reflect(meshNormal);
	}

	// 计算相机位置到镜子位置的向量view
	var view = this.mesh.position.clone().sub(this.cameraWorldPosition);
	// 将view在镜面上反射，并添加镜子的位置
	view.reflect(this.normal).negate();
	view.add(this.mesh.position);

	// 提取相机的旋转矩阵
	this.rotationMatrix.extractRotation(this.camera.matrixWorld);

	// 计算相机的观察目标位置
	this.lookAtPosition.set(0, 0, -1);
	this.lookAtPosition.applyMatrix4(this.rotationMatrix);
	this.lookAtPosition.add(this.cameraWorldPosition);

	// 计算相机观察目标位置在镜面上的反射
	var target = this.mesh.position.clone().sub(this.lookAtPosition);
	target.reflect(this.normal).negate();
	target.add(this.mesh.position);

	// 调整上向量的方向，确保在镜面上的反射
	this.up.set(0, -1, 0);
	this.up.applyMatrix4(this.rotationMatrix);
	this.up.reflect(this.normal).negate();

	// 设置渲染相机的位置、上向量、观察目标、视口宽高比
	this.mirrorCamera.position.copy(view);
	this.mirrorCamera.up = this.up;
	this.mirrorCamera.lookAt(target);
	this.mirrorCamera.aspect = this.camera.aspect;

	// 更新渲染相机投影矩阵、世界矩阵，并获取世界矩阵的逆矩阵
	this.mirrorCamera.updateProjectionMatrix();
	this.mirrorCamera.updateMatrixWorld();
	this.mirrorCamera.matrixWorldInverse.getInverse(this.mirrorCamera.matrixWorld);

	// 纹理矩阵初始化
	this.textureMatrix.set(0.5, 0.0, 0.0, 0.5,
							0.0, 0.5, 0.0, 0.5,
							0.0, 0.0, 0.5, 0.5,
							0.0, 0.0, 0.0, 1.0);
	this.textureMatrix.multiply(this.mirrorCamera.projectionMatrix);
	this.textureMatrix.multiply(this.mirrorCamera.matrixWorldInverse);

	// 斜建材参考代码：http://www.terathon.com/code/oblique.html
	// 使用镜子的法向量和镜子上的一点创建平面
	this.mirrorPlane.setFromNormalAndCoplanarPoint(this.normal, this.mesh.position);
	// 将镜子平面变换到镜子相机的坐标空间
	this.mirrorPlane.applyMatrix4(this.mirrorCamera.matrixWorldInverse);
	// 调整剪裁平面，以避免渲染在镜子后面的物体
	this.clipPlane.set(this.mirrorPlane.normal.x, this.mirrorPlane.normal.y, this.mirrorPlane.normal.z, this.mirrorPlane.constant);

	// 调整渲染相机的投影矩阵，实现斜剪裁，以正确渲染反射
	var q = new THREE.Vector4();
	var projectionMatrix = this.mirrorCamera.projectionMatrix;

	// 确保在场景中正确定位和定向镜子和相机
	q.x = (sign(this.clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
	q.y = (sign(this.clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
	q.z = -1.0;
	q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];

	var c = new THREE.Vector4();
	c = this.clipPlane.multiplyScalar(2.0 / this.clipPlane.dot(q));

	projectionMatrix.elements[2] = c.x;
	projectionMatrix.elements[6] = c.y;
	projectionMatrix.elements[10] = c.z + 1.0 - this.clipBias;
	projectionMatrix.elements[14] = c.w;
	
	var worldCoordinates = new THREE.Vector3();
	worldCoordinates.setFromMatrixPosition(this.camera.matrixWorld);
	this.eye = worldCoordinates;
};


/**
 * render：渲染镜面反射效果
 * @param {*} isTempTexture 
 */
THREE.MirrorRenderer.prototype.render = function (isTempTexture) {

	// 更新海面纹理矩阵
	if ( this.matrixNeedsUpdate ) {
		this.updateTextureMatrix();
	}

	this.matrixNeedsUpdate = true;

	// 决定使用哪个纹理进行渲染
	if ( this.scene !== undefined && this.scene instanceof THREE.Scene ) {
		var renderTexture = (isTempTexture !== undefined && isTempTexture)? this.tempTexture : this.texture;
        this.renderer.render(this.scene, this.mirrorCamera, renderTexture, true);
	}

};