"use strict";

const scaleInput = document.querySelector("#scaleInput");
const scaleValue = document.querySelector("#scaleValue");
const presetButtons = [...document.querySelectorAll(".preset")];

const MIN_SCALE_PERCENT = Number(scaleInput.min);
const MAX_SCALE_PERCENT = Number(scaleInput.max);

const clampScalePercent = (value) =>
  Math.min(MAX_SCALE_PERCENT, Math.max(MIN_SCALE_PERCENT, value));

const setActivePreset = (percent) => {
  presetButtons.forEach((button) => {
    const presetPercent = Number(button.dataset.scale) * 100;
    const isActive = Math.abs(presetPercent - percent) < 0.5;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
};

const renderScale = (percent, isDirectInput = false) => {
  const roundedPercent = Math.max(1, Math.round(percent));
  const sliderPercent = clampScalePercent(roundedPercent);

  scaleInput.value = String(sliderPercent);
  scaleInput.setAttribute("aria-valuetext", `${roundedPercent}%`);
  scaleValue.textContent = isDirectInput
    ? `${roundedPercent}% · 직접 입력`
    : `${roundedPercent}%`;
  setActivePreset(roundedPercent);
};

const syncScaleFromDimensions = () => {
  if (!sourceImage || originalWidth <= 0) return;

  const width = Number(widthInput.value);
  if (!Number.isFinite(width) || width <= 0) return;

  const percent = (width / originalWidth) * 100;
  const isOutsideSliderRange =
    percent < MIN_SCALE_PERCENT || percent > MAX_SCALE_PERCENT;

  renderScale(percent, isOutsideSliderRange);
};

const applyScalePercent = (percent, announce = false) => {
  if (!sourceImage || originalWidth <= 0 || originalHeight <= 0) return;

  const safePercent = clampScalePercent(percent);
  const scale = safePercent / 100;

  setDimensions(originalWidth * scale, originalHeight * scale);
  renderScale(safePercent);

  if (announce) {
    setStatus(`${Math.round(safePercent)}% 배율 적용`, "success");
  } else {
    setStatus("");
  }
};

scaleInput.addEventListener("input", () => {
  applyScalePercent(Number(scaleInput.value));
});

scaleInput.addEventListener("change", () => {
  setStatus(`${scaleInput.value}% 배율 적용`, "success");
});

widthInput.addEventListener("input", syncScaleFromDimensions);
heightInput.addEventListener("input", syncScaleFromDimensions);

presetButtons.forEach((button) => {
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    const percent = Number(button.dataset.scale) * 100;
    renderScale(percent);
  });
});

preview.addEventListener("load", () => {
  renderScale(100);
});

renderScale(100);
