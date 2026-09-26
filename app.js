import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

// ==========================================
// Main
// ==========================================
const videoElement = document.getElementById('webcam');
const canvasContainer = document.getElementById('canvas-container');

let scene, camera, renderer, controls, currentVrm;
let faceMeshEngine, holisticEngine;

let faceOnlyLandmarks = null;
let holisticResults = null;
let currentMode = 'BODY';

const clock = new THREE.Clock();

const CAMERA_PRESETS = {
  FULL_BODY: {
    pos: new THREE.Vector3(0.0, 0.9, 3.5),
    target: new THREE.Vector3(0.0, 0.9, 0.0)
  },
  FACE: {
    pos: new THREE.Vector3(0.0, 1.4, 1.1),
    target: new THREE.Vector3(0.0, 1.35, 0.0)
  }
};

let targetCamPos = CAMERA_PRESETS.FULL_BODY.pos.clone();
let targetControlsTarget = CAMERA_PRESETS.FULL_BODY.target.clone();

function lerp(start, end, amt) {
  return (1 - amt) * start + amt * end;
}

function setRigRotation(boneName, rotationObj, dampener = 1, lerpAmount = 0.3) {
  if (!currentVrm || !rotationObj) return;
  const bone = currentVrm.humanoid.getNormalizedBoneNode(boneName) || currentVrm.humanoid.getRawBoneNode(boneName);
  if (!bone) return;
  
  const euler = new THREE.Euler(
    (rotationObj.x || 0) * dampener, 
    (rotationObj.y || 0) * dampener, 
    (rotationObj.z || 0) * dampener, 
    'XYZ'
  );
  const quaternion = new THREE.Quaternion().setFromEuler(euler);
  bone.quaternion.slerp(quaternion, lerpAmount);
}

// ==========================================
// SETUP SCENE & KAMERA
// ==========================================
function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a24);

  camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 20.0);
  camera.position.copy(CAMERA_PRESETS.FULL_BODY.pos);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  canvasContainer.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(CAMERA_PRESETS.FULL_BODY.target); 
  controls.enableDamping = true;      
  controls.dampingFactor = 0.05;
  controls.minDistance = 0.6;         
  controls.maxDistance = 6.0;         
  controls.update();

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
  directionalLight.position.set(1.0, 2.0, 1.0);
  scene.add(directionalLight);

  setupUI();
  window.addEventListener('resize', onWindowResize);
}

// ==========================================
// UI SWITCH & LOGIC
// ==========================================
function setupUI() {
  const btnFace = document.getElementById('btn-face');
  const btnBody = document.getElementById('btn-body');
  const selectAvatar = document.getElementById('select-avatar');

  selectAvatar.addEventListener('change', (e) => {
    loadVRM(e.target.value);
  });

  btnFace.addEventListener('click', () => {
    currentMode = 'FACE';
    targetCamPos.copy(CAMERA_PRESETS.FACE.pos);
    targetControlsTarget.copy(CAMERA_PRESETS.FACE.target);
    btnFace.classList.add('active');
    btnBody.classList.remove('active');
  });

  btnBody.addEventListener('click', () => {
    currentMode = 'BODY';
    targetCamPos.copy(CAMERA_PRESETS.FULL_BODY.pos);
    targetControlsTarget.copy(CAMERA_PRESETS.FULL_BODY.target);
    btnBody.classList.add('active');
    btnFace.classList.remove('active');
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ==========================================
// LOAD & SWAP MODEL .VRM 
// =========================================
function loadVRM(modelPath) {
  if (currentVrm) {
    scene.remove(currentVrm.scene);
    VRMUtils.deepDispose(currentVrm.scene); 
    currentVrm = null;
  }

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  loader.load(
    modelPath,
    (gltf) => {
      const vrm = gltf.userData.vrm;
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.removeUnnecessaryJoints(gltf.scene);

      currentVrm = vrm;
      scene.add(vrm.scene);
      vrm.scene.rotation.y = Math.PI; 
      console.log("Karakter berhasil dimuat:", modelPath);
    },
    (progress) => {
      console.log(`Loading Avatar: ${((progress.loaded / progress.total) * 100).toFixed(0)}%`);
    },
    (error) => {
      console.error("Gagal memuat model VRM:", error);
    }
  );
}

// ==========================================
// MEDIAPIPE DUAL ENGINE
// ==========================================
function initMediaPipe() {
  faceMeshEngine = new window.FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });
  faceMeshEngine.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  faceMeshEngine.onResults((results) => {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      faceOnlyLandmarks = results.multiFaceLandmarks[0];
    } else {
      faceOnlyLandmarks = null;
    }
  });

  holisticEngine = new window.Holistic({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
  });
  holisticEngine.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  holisticEngine.onResults((results) => {
    holisticResults = results;
  });

  const cameraHelper = new window.Camera(videoElement, {
    onFrame: async () => {
      try {
        if (currentMode === 'FACE') {
          await faceMeshEngine.send({ image: videoElement });
        } else {
          await holisticEngine.send({ image: videoElement });
        }
      } catch (e) {
        console.error("Tracking Frame Error:", e);
      }
    },
    width: 640,
    height: 480
  });

  cameraHelper.start();
}

const armPoseLeft = new THREE.Euler(0, 0, Math.PI / 2.6);
const armPoseRight = new THREE.Euler(0, 0, -Math.PI / 2.6);

// ==========================================
// ANIMATION LOOP
// ==========================================
function animate() {
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();

  camera.position.lerp(targetCamPos, 0.08);
  controls.target.lerp(targetControlsTarget, 0.08);
  controls.update();

  if (currentVrm) {
    if (currentMode === 'FACE') {
      const leftUpperArm = currentVrm.humanoid.getNormalizedBoneNode('leftUpperArm') || currentVrm.humanoid.getRawBoneNode('leftUpperArm');
      const rightUpperArm = currentVrm.humanoid.getNormalizedBoneNode('rightUpperArm') || currentVrm.humanoid.getRawBoneNode('rightUpperArm');
      if (leftUpperArm) leftUpperArm.rotation.copy(armPoseLeft);
      if (rightUpperArm) rightUpperArm.rotation.copy(armPoseRight);

      if (faceOnlyLandmarks) {
        const riggedFace = window.Kalidokit.Face.solve(faceOnlyLandmarks, {
          runtime: 'mediapipe',
          video: videoElement
        });

        if (riggedFace) {
          const head = currentVrm.humanoid.getNormalizedBoneNode('head') || currentVrm.humanoid.getRawBoneNode('head');
          if (head) {
            head.rotation.x = lerp(head.rotation.x, riggedFace.head.x, 0.3);
            head.rotation.y = lerp(head.rotation.y, riggedFace.head.y, 0.3);
            head.rotation.z = lerp(head.rotation.z, riggedFace.head.z, 0.3);
          }

          const blendshapes = currentVrm.expressionManager;
          if (blendshapes) {
            blendshapes.setValue('blinkLeft', lerp(blendshapes.getValue('blinkLeft') || 0, 1 - riggedFace.eye.l, 0.4));
            blendshapes.setValue('blinkRight', lerp(blendshapes.getValue('blinkRight') || 0, 1 - riggedFace.eye.r, 0.4));
            blendshapes.setValue('aa', lerp(blendshapes.getValue('aa') || 0, riggedFace.mouth.shape.A, 0.3));
          }
        }
      }
    } 
    else if (currentMode === 'BODY' && holisticResults) {
      if (holisticResults.poseLandmarks && holisticResults.poseWorldLandmarks) {
        try {
          const riggedPose = window.Kalidokit.Pose.solve(
            holisticResults.poseWorldLandmarks, 
            holisticResults.poseLandmarks, 
            { runtime: 'mediapipe', video: videoElement }
          );

          if (riggedPose) {
            setRigRotation('hips', riggedPose.Hips.rotation, 0.7);
            setRigRotation('chest', riggedPose.Spine, 0.8, 0.3);
            setRigRotation('spine', riggedPose.Spine, 0.8, 0.3);
            
            setRigRotation('rightUpperArm', riggedPose.RightUpperArm, 1, 0.3);
            setRigRotation('rightLowerArm', riggedPose.RightLowerArm, 1, 0.3);
            setRigRotation('leftUpperArm', riggedPose.LeftUpperArm, 1, 0.3);
            setRigRotation('leftLowerArm', riggedPose.LeftLowerArm, 1, 0.3);
            
            setRigRotation('leftUpperLeg', riggedPose.LeftUpperLeg, 1, 0.3);
            setRigRotation('leftLowerLeg', riggedPose.LeftLowerLeg, 1, 0.3);
            setRigRotation('rightUpperLeg', riggedPose.RightUpperLeg, 1, 0.3);
            setRigRotation('rightLowerLeg', riggedPose.RightLowerLeg, 1, 0.3);
          }
        } catch (err) {}
      }

      if (holisticResults.faceLandmarks) {
        try {
          const riggedFace = window.Kalidokit.Face.solve(holisticResults.faceLandmarks, {
            runtime: 'mediapipe',
            video: videoElement
          });

          if (riggedFace) {
            const head = currentVrm.humanoid.getNormalizedBoneNode('head') || currentVrm.humanoid.getRawBoneNode('head');
            if (head) {
              head.rotation.x = lerp(head.rotation.x, riggedFace.head.x, 0.3);
              head.rotation.y = lerp(head.rotation.y, riggedFace.head.y, 0.3);
              head.rotation.z = lerp(head.rotation.z, riggedFace.head.z, 0.3);
            }

            const blendshapes = currentVrm.expressionManager;
            if (blendshapes) {
              blendshapes.setValue('blinkLeft', lerp(blendshapes.getValue('blinkLeft') || 0, 1 - riggedFace.eye.l, 0.4));
              blendshapes.setValue('blinkRight', lerp(blendshapes.getValue('blinkRight') || 0, 1 - riggedFace.eye.r, 0.4));
              blendshapes.setValue('aa', lerp(blendshapes.getValue('aa') || 0, riggedFace.mouth.shape.A, 0.3));
            }
          }
        } catch (err) {}
      }
    }

    currentVrm.update(deltaTime);
  }

  renderer.render(scene, camera);
}

// ==========================================
// Running
// ==========================================
initThree();
initMediaPipe();

const initialAvatarPath = document.getElementById('select-avatar').value;
loadVRM(initialAvatarPath);

animate();