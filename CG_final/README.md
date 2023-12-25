CG_final/
|-- img/											# 天空、山峰、雨丝图片，略
|
|-- libs/											# dat.GUI, jQuery, three.js库
|   |-- dat.gui.min.js
|		|-- jquery-3.6.0.min.js
|		|-- MTLLoader.js
|		|-- OBJMTLLoader.js
|		|-- OrbitControls.js
|		|-- three.min.js
|
|-- models/										# 轮船模型相关文件，略
|
|-- renderers/
|		|-- MirrorRenderer.js			# 海面镜面反射效果实现
|		|-- Ocean.js							# 海水波动效果实现
|
|-- shaders/
|		|-- CloudShader.js				# 云层动画
|		|-- FFTOceanWave.js				# 傅里叶变换
|		|-- OceanShader.js				# 海水波动效果
|		|-- RainShader.js					# 雨丝效果着色器
|		|-- ScreenSpaceShader.js	# 计算相机视角变换
|
|-- index.html
|-- main.js