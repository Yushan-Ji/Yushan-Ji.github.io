THREE.ShaderChunk["screenplane_pars_vertex"] = [
		
		'const float infinite = 150000.0;',
		'const float screenScale = 1.2;',
		'const vec3 groundNormal = vec3( 0.0, 1.0, 0.0 );',
		'const float groundHeight = 0.0;',
		
		'varying vec3 vCamPosition;',
		
		'vec3 interceptPlane( in vec3 source, in vec3 dir, in vec3 normal, float height )',
		'{',
			// Compute the distance between the source and the surface, following a ray, then return the intersection
      // http://www.cs.rpi.edu/~cutler/classes/advancedgraphics/S09/lectures/11_ray_tracing.pdf
		'	float distance = ( - height - dot( normal, source ) ) / dot( normal, dir );',
		'	if( distance < 0.0 )',
		'		return source + dir * distance;',
		'	else ',
		'		return - ( vec3( source.x, height, source.z ) + vec3( dir.x, height, dir.z ) * infinite );',
		'}',
		
		'mat3 getRotation()',
		'{',
			// Extract the 3x3 rotation matrix from the 4x4 view matrix
		'	return mat3( ',
		'		viewMatrix[0].xyz,',
		'		viewMatrix[1].xyz,',
		'		viewMatrix[2].xyz',
		'	);',
		'}',
		
		'vec3 getCameraPos( in mat3 rotation )',
		'{',
			// Xc = R * Xw + t
			// c = - R.t() * t <=> c = - t.t() * R
		'	return - viewMatrix[3].xyz * rotation;',
		'}',

		'vec2 getImagePlan()',
		'{',
			// Extracting aspect and focal from projection matrix:
			// P = | e   0       0   0 |
			//     | 0   e/(h/w) 0   0 |
			//     | 0   0       .   . |
			//     | 0   0       -1  0 |
		'	float focal = projectionMatrix[0].x;',
		'	float aspect = projectionMatrix[1].y;',
			
			// Fix coordinate aspect and scale
		'	return vec2( ( uv.x - 0.5 ) * screenScale * aspect, ( uv.y - 0.5 ) * screenScale * focal );',
		'}',
		
		'vec3 getCamRay( in mat3 rotation, in vec2 screenUV )',
		'{',
			// Compute camera ray then rotate it in order to get it in world coordinate
		'	return vec3( screenUV.x, screenUV.y, projectionMatrix[0].x ) * rotation;',
		'}',
		
		'vec3 computeProjectedPosition()',
		'{',
			// Extract camera position and rotation from the model view matrix
		'	mat3 cameraRotation = getRotation();',
		'	vec3 camPosition = getCameraPos( cameraRotation );',
		'	vCamPosition = camPosition;',
		
			// Return the intersection between the camera ray and a given plane
		'	if( camPosition.y < groundHeight )',
		'		return vec3( 0.0, 0.0, 0.0 );',
		
			// Extract coordinate of the vertex on the image plan
		'	vec2 screenUV = getImagePlan() ;',
			
			// Compute the ray from camera to world
		'	vec3 ray = getCamRay( cameraRotation, screenUV );',
			
		'	vec3 finalPos = interceptPlane( camPosition, ray, groundNormal, groundHeight );',
		
		'	float distance = length( finalPos );',
		'	if( distance > infinite )',
		'		finalPos *= infinite / distance;',
		
		'	return finalPos;',
		'}'
	
].join('\n');

THREE.ShaderChunk["screenplane_vertex"] = [
	'vec4 screenPlaneWorldPosition = vec4( computeProjectedPosition(), 1.0 );',
].join('\n');

THREE.ShaderChunk["screenplane_pars_fragment"] = [
		'varying vec3 vCamPosition;'
].join('\n');

THREE.ShaderLib['ocean_main'] = {
	uniforms: THREE.UniformsLib[ "oceanfft" ],
  
	vertexShader: [
		'precision highp float;',
		
		'varying vec3 vWorldPosition;',
		'varying vec4 vReflectCoordinates;',

		'uniform mat4 u_mirrorMatrix;',
		
		THREE.ShaderChunk[ "screenplane_pars_vertex" ],
		THREE.ShaderChunk[ "oceanfft_pars_vertex" ],

		'void main (void) {',
			THREE.ShaderChunk[ "screenplane_vertex" ],
			
			'vec4 worldPosition = screenPlaneWorldPosition;',
			
			THREE.ShaderChunk[ "oceanfft_vertex" ],
			
			'vWorldPosition = oceanfftWorldPosition.xyz;',
			'vReflectCoordinates = u_mirrorMatrix * oceanfftWorldPosition;',
			
			'gl_Position = projectionMatrix * viewMatrix * oceanfftWorldPosition;',
		'}'
	].join('\n'),
  
	vertexShaderNoTexLookup: [
		'precision highp float;',
		
		'varying vec3 vWorldPosition;',
		'varying vec4 vReflectCoordinates;',

		'uniform mat4 u_mirrorMatrix;',
		
		THREE.ShaderChunk[ "screenplane_pars_vertex" ],
		THREE.ShaderChunk[ "oceanfft_pars_vertex" ],

		'void main (void) {',
			THREE.ShaderChunk[ "screenplane_vertex" ],
			
			'vWorldPosition = screenPlaneWorldPosition.xyz;',
			'vReflectCoordinates = u_mirrorMatrix * screenPlaneWorldPosition;',
			
			'gl_Position = projectionMatrix * viewMatrix * screenPlaneWorldPosition;',
		'}'
	].join('\n'),
  
	fragmentShader: [
		'varying vec3 vWorldPosition;',
		'varying vec4 vReflectCoordinates;',

		'uniform sampler2D u_reflection;',
		'uniform sampler2D u_normalMap;',
		'uniform vec3 u_oceanColor;',
		'uniform vec3 u_sunDirection;',
		'uniform float u_exposure;',

		'vec3 hdr (vec3 color, float exposure) {',
			'return 1.0 - exp(-color * exposure);',
		'}',
		
		THREE.ShaderChunk["screenplane_pars_fragment"],

		'void main (void) {',
			'vec3 normal = texture2D( u_normalMap, vWorldPosition.xz * 0.002 ).rgb;',
			'vec3 view = normalize( vCamPosition - vWorldPosition );',
			
			// Compute the specular factor
			'vec3 reflection = normalize( reflect( -u_sunDirection, normal ) );',
			'float specularFactor = pow( max( 0.0, dot( view, reflection ) ), 500.0 ) * 20.0;',
		
			// Get reflection color
			'vec3 distortion = 200.0 * normal * vec3( 1.0, 0.0, 0.1 );',	
			'vec3 reflectionColor = texture2DProj( u_reflection, vReflectCoordinates.xyz + distortion ).xyz;',
			
			// Smooth the normal following the distance
			'float distanceRatio = min( 1.0, log( 1.0 / length( vCamPosition - vWorldPosition ) * 3000.0 + 1.0 ) );',
			'distanceRatio *= distanceRatio;',
			'distanceRatio = distanceRatio * 0.7 + 0.3;',
			//'distanceRatio = 1.0;',
			'normal = ( distanceRatio * normal + vec3( 0.0, 1.0 - distanceRatio, 0.0 ) ) * 0.5;',
			'normal /= length( normal );',
			
			// Compute the fresnel ratio
			'float fresnel = pow( 1.0 - dot( normal, view ), 2.0 );',
			
			// Compute the sky reflection and the water color
			'float skyFactor = ( fresnel + 0.2 ) * 10.0;',
			'vec3 waterColor = ( 1.0 - fresnel ) * u_oceanColor;',
			
			// Compute the final color
			'vec3 color = ( skyFactor + specularFactor + waterColor ) * reflectionColor + waterColor * 0.5 ;',
			'color = hdr( color, u_exposure );',

			'gl_FragColor = vec4( color, 1.0 );',
		'}'
	].join('\n')
};