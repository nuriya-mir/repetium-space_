'use client'

import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
// Droid Sans Bold covers A-Z, a-z and all French diacritics (à â æ ç é è ê ë î ï ô œ ù û ü ÿ)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontJson = require('three/examples/fonts/droid/droid_sans_bold.typeface.json')
import styles from './Letter3D.module.css'

interface Letter3DProps {
  letter: string
  size?: number
  interactive?: boolean
}

type Scene3D = {
  renderer: THREE.WebGLRenderer
  mesh: THREE.Mesh | null
  rotX: number
  rotY: number
  velX: number
  velY: number
  dragging: boolean
  lastX: number
  lastY: number
  animId: number
}

export function Letter3D({ letter, size = 200, interactive = true }: Letter3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<Scene3D | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const cs = getComputedStyle(document.documentElement)
    const paperS = cs.getPropertyValue('--paper-s').trim() || '#EEEDEA'
    const blueHex = cs.getPropertyValue('--blue').trim() || '#5A7A9E'
    const ink3Hex = cs.getPropertyValue('--ink-3').trim() || '#8A8A92'

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(size, size)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(new THREE.Color(paperS))
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    camera.position.z = 5

    const ambient = new THREE.AmbientLight(0xffffff, 0.55)
    scene.add(ambient)
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9)
    keyLight.position.set(3, 4, 5)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.25)
    fillLight.position.set(-3, -2, 2)
    scene.add(fillLight)

    const loader = new FontLoader()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const font = loader.parse(fontJson as any)

    const geo = new TextGeometry(letter, {
      font,
      size: 1.4,
      depth: 0.14,
      curveSegments: 14,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 5,
    })

    geo.computeBoundingBox()
    const bb = geo.boundingBox!
    const cx = (bb.max.x - bb.min.x) / 2
    const cy = (bb.max.y - bb.min.y) / 2
    geo.translate(-bb.min.x - cx, -bb.min.y - cy, -0.07)

    // Group 0 = sides/bevel (edge), Group 1 = front/back caps (face)
    const edgeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(ink3Hex), roughness: 0.6, metalness: 0.0 })
    const faceMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(blueHex), roughness: 0.35, metalness: 0.10 })

    const mesh = new THREE.Mesh(geo, [edgeMat, faceMat])
    mesh.rotation.x = 0.3
    mesh.rotation.y = -0.4
    scene.add(mesh)

    const state: Scene3D = {
      renderer, mesh,
      rotX: 0.3, rotY: -0.4,
      velX: 0, velY: 0,
      dragging: false, lastX: 0, lastY: 0,
      animId: 0,
    }
    stateRef.current = state

    function tick() {
      state.animId = requestAnimationFrame(tick)
      if (!state.dragging) {
        state.velX *= 0.92
        state.velY *= 0.92
        state.rotX += state.velX
        state.rotY += state.velY
      }
      if (state.mesh) {
        state.mesh.rotation.x = state.rotX
        state.mesh.rotation.y = state.rotY
      }
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(state.animId)
      renderer.dispose()
      geo.dispose()
      edgeMat.dispose()
      faceMat.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [letter, size])

  function handlePointerDown(e: React.PointerEvent) {
    const state = stateRef.current
    if (!interactive || !state) return
    state.dragging = true
    state.lastX = e.clientX
    state.lastY = e.clientY
    state.velX = 0
    state.velY = 0
  }

  function handlePointerMove(e: React.PointerEvent) {
    const state = stateRef.current
    if (!state?.dragging) return
    const dx = e.clientX - state.lastX
    const dy = e.clientY - state.lastY
    state.velY = dx * 0.013
    state.velX = dy * 0.013
    state.rotY += state.velY
    state.rotX += state.velX
    state.lastX = e.clientX
    state.lastY = e.clientY
  }

  function handlePointerUp() {
    if (stateRef.current) stateRef.current.dragging = false
  }

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{ width: size, height: size }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  )
}
