# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Enterprise Site Operations teams, Safety Directors, and Environmental Health & Safety (EHS) officers overseeing large-scale industrial facilities, construction zones, and manufacturing floors. They need continuous, automated oversight of worker safety compliance and clear incident escalation pathways.

## Product Purpose

SafeSight AI delivers real-time computer vision safety compliance monitoring across image inspections, asynchronous video streams, and live webcam feeds. It automatically identifies Personal Protective Equipment (PPE) violations—specifically missing hard hats and safety vests—reducing job-site injury risks, accelerating incident response, and providing reliable compliance audit trails.

## Positioning

A pluggable vision AI safety platform featuring a "bring-your-own-model" architecture: teams can deploy fine-tuned YOLO checkpoints (`best.pt` and custom class definitions) tailored to their specific operational hazards, coupled with high-speed local inference, immediate visual feedback, and zero forced cloud dependencies.

## Operating Context

- **Environment**: Centralized control rooms, on-site safety trailers, security desks, and industrial inspection workstations.
- **Workflows**: Live multi-feed monitoring, batch video processing of surveillance footage, rapid single-frame photo verification, and historical compliance audits.
- **Key Interactivity**: Color-coded bounding boxes, confidence score filtering, live violation alerts, and inspection history review.

## Capabilities and Constraints

- **Live & Async Vision Processing**: Real-time webcam inference alongside background queue processing for multi-part video uploads and static image inspections.
- **Pluggable Weights**: Dynamic model loading using local YOLO weights (`best.pt`).
- **Safety Assessment Engine**: Automated classification of detections into compliance vs. safety violations (e.g., missing helmet, missing vest).
- **Architecture**: Next.js 16 (React 19) frontend talking to a Python FastAPI backend (OpenCV + Ultralytics YOLO) over HTTP with optional persistent MongoDB logging.
- **Constraints**: Backend inference requires local GPU/CPU compute; client video stream bandwidth depends on network conditions.

## Brand Commitments

- **Name**: SafeSight AI (SafeSight).
- **Tone & Voice**: Authoritative, vigilant, precise, enterprise-grade, and safety-focused.
- **Visual Identity**: High-contrast indicator states (safe/verified green, warning amber, violation crimson), technical precision, and clean operational density.

## Evidence on Hand

- Core model checkpoint `best.pt` in the repository root.
- Working FastAPI backend (`backend/app`) with health checks, image detection, video processing, and inspection endpoints.
- Functional Next.js dashboard (`frontend/app/page.tsx`) with landing view, live camera capture, video upload, and history viewer.
- *Notice*: No fabricated external customer case studies or external partner logos exist; do not invent marketing claims or false compliance certifications.

## Product Principles

1. **Unambiguous Visual Clarity**: Detection bounding boxes, labels, and confidence metrics must be immediately readable at a glance during critical operations.
2. **Rapid Escalation & Triage**: Violations must be instantly differentiated from compliant gear so operators can react without hesitation.
3. **Model Adaptability**: The system must remain adaptable to custom industry hazards by prioritizing simple model weight swaps (`best.pt`).
4. **Operational Resilience**: Maintain rock-solid stability during long-running camera streams and large video batch evaluations.
