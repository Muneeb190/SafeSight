from __future__ import annotations

import re
from collections.abc import Sequence

from app.schemas import Detection, SafetyAssessment

RULE_VERSION = "safety-rules-1"

# Only explicit non-compliance labels can create a potential violation.
# A positive PPE/equipment label is not evidence that a worker is wearing PPE.
_VIOLATION_PATTERNS = (
    re.compile(r"\b(?:no|without|missing)\s+(?:hard\s*hat|helmet|hat)\b", re.IGNORECASE),
    re.compile(r"\b(?:no|without|missing)\s+(?:safety\s*)?vest\b", re.IGNORECASE),
    re.compile(r"\b(?:no|without|missing)\s+(?:safety\s*)?boots?\b", re.IGNORECASE),
    re.compile(r"\b(?:no|without|missing)\s+(?:safety\s*)?gloves?\b", re.IGNORECASE),
    re.compile(r"\b(?:no|without|missing)\s+(?:safety\s*)?glasses\b", re.IGNORECASE),
    re.compile(r"\b(?:helmet|hardhat|hat|vest|boot|boots|glove|gloves)[_\s-]*missing\b", re.IGNORECASE),
    re.compile(
        r"\b(?:no|without|missing)[_\s-]*(?:hard[_\s-]*hat|helmet|hat|(?:safety[_\s-]*)?vest|(?:safety[_\s-]*)?boots?|(?:safety[_\s-]*)?gloves?)\b",
        re.IGNORECASE,
    ),
)


def is_explicit_violation_label(class_name: str) -> bool:
    return any(pattern.search(class_name.replace("_", " ")) for pattern in _VIOLATION_PATTERNS)


def assess_safety(
    class_names: Sequence[str],
    detections: Sequence[Detection],
) -> SafetyAssessment:
    supported_labels = sorted({name for name in class_names if is_explicit_violation_label(name)})
    detected_violations = sorted(
        {
            detection.class_name
            for detection in detections
            if is_explicit_violation_label(detection.class_name)
        }
    )

    if detected_violations:
        return SafetyAssessment(
            status="potential_violation",
            requires_human_review=True,
            rule_version=RULE_VERSION,
            violations=detected_violations,
            notes=[
                "A model prediction is not a determination of compliance; a qualified person must review the evidence."
            ],
        )

    if not supported_labels:
        return SafetyAssessment(
            status="unsupported",
            requires_human_review=True,
            rule_version=RULE_VERSION,
            notes=[
                "The loaded model has no explicit missing-PPE class for the configured safety rules.",
                "Equipment detections alone cannot establish whether each worker is wearing required PPE.",
            ],
        )

    return SafetyAssessment(
        status="no_supported_violation_detected",
        requires_human_review=True,
        rule_version=RULE_VERSION,
        notes=[
            "No supported violation class was detected; this does not prove that the scene is safe or that every worker is compliant."
        ],
    )
