# Web_Vtuber_Avatar_Studio
# 🎭 Hybrid 3D VRM Avatar Tracker

A lightweight, web-based 3D avatar tracking application powered by **Three.js**, **MediaPipe**, and **Kalidokit**. This project features a hybrid tracking system that automatically switches between **MediaPipe FaceMesh** (for high-FPS close-up face tracking) and **MediaPipe Holistic** (for full-body motion capture).

![License](https://img.shields.io/badge/License-MIT-green.svg)
![Three.js](https://img.shields.io/badge/Three.js-r160-black.svg)
![MediaPipe](https://img.shields.io/badge/MediaPipe-FaceMesh%20%7C%20Holistic-blue.svg)

---

## ✨ Features

- ⚡ **Hybrid Tracking Engine**:
  - **Face Mode**: Uses MediaPipe FaceMesh for lightweight, high-FPS facial expressions and eye tracking.
  - **Body Mode**: Uses MediaPipe Holistic for full-body skeletal tracking.
- 🔄 **Dynamic Character Swapper**: Switch between multiple `.vrm` avatars on the fly with automatic GPU memory disposal (`VRMUtils.deepDispose`).
- 🎥 **Smooth Camera Controls**: Seamless transitions between Face and Full-Body views using vector interpolation (`lerp`).
- 🚀 **Zero Backend Required**: Runs completely client-side in the browser.

---

## 🛠️ Tech Stack

- **3D Rendering**: [Three.js](https://threejs.org/) & [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- **Computer Vision**: [MediaPipe FaceMesh](https://developers.google.com/mediapipe/solutions/vision/face_landmarker) & [MediaPipe Holistic](https://developers.google.com/mediapipe/solutions/vision/holistic_landmarker)
- **Kinematics & Rigging**: [Kalidokit](https://github.com/yeemachine/kalidokit)
- **Frontend**: Vanilla HTML5, CSS3, ES6 JavaScript Modules

---

## 📁 Project Structure

```text
├── models/
│   ├── avatar1.vrm
│   ├── avatar2.vrm
│   └── avatar3.vrm
├── app.js
├── index.html
└── README.md
