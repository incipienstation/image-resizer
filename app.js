"use strict";

const scaleStylesheet = document.createElement("link");
scaleStylesheet.rel = "stylesheet";
scaleStylesheet.href = "./scale.css";
document.head.append(scaleStylesheet);

const MAX_DIMENSION = 32768;
const MAX_OUTPUT_PIXELS = 32_000_000;
const MAX_INPUT_BYTES = 100 * 1024 * 1024;
const MIN_SCALE_PERCENT = 1;
const MAX_SCALE_PERCENT = 400;
const SUPPORTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/bmp",
  "image/heic",
  "image/heif",
]);
const SUPPORTED_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "avif",
  "gif",
  "bmp",
  "heic",
  "heif",
]);

const fileInput = document.querySelector("#fileInput");
const uploadArea = document.querySelector("#uploadArea");
const workspace = document.querySelector("#workspace");
const preview = document.querySelector("#preview");
const widthInput = document.querySelector("#widthInput");
const heightInput = document.querySelector("#heightInput");
const scaleInput = document.querySelector("#scaleInput");
const scaleValue = document.querySelector("#scaleValue");
const scaleMinValue = document.querySelector(".scale-range span:first-child");
const scaleMaxValue = document.querySelector(".scale-range span:last-child");
const presetButtons = [...document.querySelectorAll(".preset")];
const formatSelect = document.querySelector("#formatSelect");
const qualityInput = document.querySelector("#qualityInput");
const qualityValue = document.querySelector("#qualityValue");
const qualityLabel = document.querySelector("#qualityLabel");
const fileMeta = document.querySelector("#fileMeta");
const sizeMeta = document.querySelector("#sizeMeta");
const replaceButton = document.querySelector("#replaceButton");
const downloadButton = document.querySelector("#downloadButton");
const status = document.querySelector("#status");
const canvas = document.querySelector("#canvas");

let sourceFile = null;
let sourceImage = null;
let sourceUrl = null;
let originalWidth = 0;
let originalHeight = 0;
let aspectRatio = 1;
let maxScalePercent = MAX_SCALE_PERCENT;
let syncingDimension = false;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const setStatus = (message = "", kind = "") => {
  status.textContent = message;
  status.className = `status${kind ? ` ${kind}` : ""}`;
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const sanitizeName = (name) => {
  const withoutExtension = name.replace(/\.[^/.]+$/, "");
  const normalized = withoutExtension
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/^\.+/, "")
    .trim();

  return (normalized || "image").slice(0, 120);
};

const getExtension = (mime) => {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
};

const getFileExtension = (name) => name.split(".").pop()?.toLowerCase() ?? "";

const isSupportedRasterImage = (file) => {
  if (file.type === "image/svg+xml") return false;
  if (SUPPORTED_MIME_TYPES.has(file.type)) return true;
  return file.type === "" && SUPPORTED_EXTENSIONS.has(getFileExtension(file.name));
};

const releaseSourceUrl = () => {
  if (!sourceUrl) return;
  URL.revokeObjectURL(sourceUrl);
  sourceUrl = null;
};

const setDimensions = (width, height) => {
  syncingDimension = true;
  widthInput.value = Math.max(1, Math.round(width));
  heightInput.value = Math.max(1, Math.round(height));
  syncingDimension = false;
};

const calculateMaxScalePercent = () => {
  if (!originalWidth || !originalHeight) return MAX_SCALE_PERCENT;

  const dimensionLimit = Math.min(
    MAX_DIMENSION / originalWidth,
    MAX_DIMENSION / originalHeight,
  );
  const pixelLimit = Math.sqrt(
    MAX_OUTPUT_PIXELS / (originalWidth * originalHeight),
  );
  const safePercent = Math.floor(
    Math.min(MAX_SCALE_PERCENT, dimensionLimit * 100, pixelLimit * 100),
  );

  return Math.max(MIN_SCALE_PERCENT, safePercent);
};

const updatePresetState = (percent) => {
  presetButtons.forEach((button) => {
    const buttonPercent = Math.round(Number(button.dataset.scale) * 100);
    const isActive = buttonPercent === Math.round(percent);

    button.disabled = buttonPercent > maxScalePercent;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
};

const updateScaleControl = (percent) => {
  const roundedPercent = Math.max(MIN_SCALE_PERCENT, Math.round(percent));

  scaleValue.textContent = `${roundedPercent}%`;
  scaleInput.value = String(
    clamp(roundedPercent, MIN_SCALE_PERCENT, maxScalePercent),
  );
  updatePresetState(roundedPercent);
};

const applyScale = (percent, announce = false) => {
  if (!sourceImage) return;

  const boundedPercent = clamp(
    Math.round(percent),
    MIN_SCALE_PERCENT,
    maxScalePercent,
  );
  const width = Math.max(
    1,
    Math.round((originalWidth * boundedPercent) / 100),
  );
  const height = Math.max(
    1,
    Math.round((originalHeight * boundedPercent) / 100),
  );

  setDimensions(width, height);
  updateScaleControl(boundedPercent);
  setStatus(
    `${boundedPercent}% · ${width.toLocaleString()} × ${height.toLocaleString()} px`,
    announce ? "success" : "",
  );
};

const configureScaleControl = () => {
  maxScalePercent = calculateMaxScalePercent();
  scaleInput.min = String(MIN_SCALE_PERCENT);
  scaleInput.max = String(maxScalePercent);
  scaleMinValue.textContent = `${MIN_SCALE_PERCENT}%`;
  scaleMaxValue.textContent = `${maxScalePercent}%`;

  const initialPercent = Math.min(100, maxScalePercent);
  applyScale(initialPercent);

  return initialPercent;
};

const syncScaleFromManualInput = (percent) => {
  const roundedPercent = Math.max(MIN_SCALE_PERCENT, Math.round(percent));
  const width = Number(widthInput.value);
  const height = Number(heightInput.value);

  updateScaleControl(roundedPercent);

  if (roundedPercent > maxScalePercent) {
    setStatus(
      `안전 한도 ${maxScalePercent}%를 초과했습니다. 배율이나 픽셀 크기를 줄여주세요.`,
      "error",
    );
    return;
  }

  setStatus(
    `${roundedPercent}% · ${Math.round(width).toLocaleString()} × ${Math.round(height).toLocaleString()} px`,
  );
};

const validateDimensions = () => {
  const width = Number(widthInput.value);
  const height = Number(heightInput.value);

  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("너비와 높이는 1 이상의 정수여야 합니다.");
  }

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new Error(`한 변은 최대 ${MAX_DIMENSION.toLocaleString()} px까지 지원합니다.`);
  }

  if (width * height > MAX_OUTPUT_PIXELS) {
    throw new Error("출력 이미지가 32 MP를 초과합니다. 모바일 메모리 보호를 위해 크기를 줄여주세요.");
  }

  return { width, height };
};

const resetOutputDefaults = () => {
  const preferredMime =
    sourceFile?.type === "image/jpeg"
      ? "image/jpeg"
      : sourceFile?.type === "image/webp"
        ? "image/webp"
        : "image/png";

  formatSelect.value = preferredMime;
  const isPng = formatSelect.value === "image/png";
  qualityLabel.style.opacity = isPng ? "0.48" : "1";
  qualityInput.disabled = isPng;
};

const loadImageFile = async (file) => {
  if (!isSupportedRasterImage(file)) {
    setStatus("지원되는 래스터 이미지(PNG/JPEG/WebP/AVIF/GIF/BMP/HEIC)를 선택해주세요. SVG는 보안상 차단됩니다.", "error");
    return;
  }

  if (file.size <= 0 || file.size > MAX_INPUT_BYTES) {
    setStatus("입력 파일은 0 B보다 크고 100 MB 이하여야 합니다.", "error");
    return;
  }

  setStatus("이미지를 읽는 중…");
  downloadButton.disabled = true;

  const nextUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("이 브라우저에서 이미지를 디코딩할 수 없습니다."));
      image.src = nextUrl;
    });

    const nextWidth = image.naturalWidth;
    const nextHeight = image.naturalHeight;

    if (!nextWidth || !nextHeight) {
      throw new Error("이미지 크기를 확인할 수 없습니다.");
    }

    releaseSourceUrl();
    sourceUrl = nextUrl;
    sourceFile = file;
    sourceImage = image;
    originalWidth = nextWidth;
    originalHeight = nextHeight;
    aspectRatio = originalWidth / originalHeight;

    preview.src = sourceUrl;
    fileMeta.textContent = `${file.name} · ${formatBytes(file.size)}`;
    sizeMeta.textContent = `${originalWidth.toLocaleString()} × ${originalHeight.toLocaleString()} px`;
    const initialPercent = configureScaleControl();
    resetOutputDefaults();

    uploadArea.style.display = "none";
    workspace.classList.add("active");

    const scaleNotice =
      initialPercent < 100
        ? ` · 원본이 커서 안전 한도 ${maxScalePercent}%로 시작`
        : "";
    setStatus(
      `원본 비율 잠금 · EXIF/GPS 메타데이터 제거${scaleNotice}`,
      "success",
    );
  } catch (error) {
    URL.revokeObjectURL(nextUrl);
    setStatus(error instanceof Error ? error.message : "이미지를 불러오지 못했습니다.", "error");
  } finally {
    downloadButton.disabled = false;
    fileInput.value = "";
  }
};

fileInput.addEventListener("change", () => {
  const [file] = fileInput.files ?? [];
  if (file) void loadImageFile(file);
});

["dragenter", "dragover"].forEach((eventName) => {
  uploadArea.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadArea.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  uploadArea.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadArea.classList.remove("dragging");
  });
});

uploadArea.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer?.files ?? [];
  if (file) void loadImageFile(file);
});

widthInput.addEventListener("input", () => {
  if (syncingDimension || !sourceImage) return;

  const width = Number(widthInput.value);
  if (!Number.isFinite(width) || width <= 0) return;

  syncingDimension = true;
  heightInput.value = Math.max(1, Math.round(width / aspectRatio));
  syncingDimension = false;
  syncScaleFromManualInput((width / originalWidth) * 100);
});

heightInput.addEventListener("input", () => {
  if (syncingDimension || !sourceImage) return;

  const height = Number(heightInput.value);
  if (!Number.isFinite(height) || height <= 0) return;

  syncingDimension = true;
  widthInput.value = Math.max(1, Math.round(height * aspectRatio));
  syncingDimension = false;
  syncScaleFromManualInput((height / originalHeight) * 100);
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!sourceImage || button.disabled) return;

    const percent = Math.round(Number(button.dataset.scale) * 100);
    applyScale(percent, true);
  });
});

scaleInput.addEventListener("input", () => {
  applyScale(Number(scaleInput.value));
});

scaleInput.addEventListener("change", () => {
  applyScale(Number(scaleInput.value), true);
});

formatSelect.addEventListener("change", () => {
  const isPng = formatSelect.value === "image/png";
  qualityInput.disabled = isPng;
  qualityLabel.style.opacity = isPng ? "0.48" : "1";
});

qualityInput.addEventListener("input", () => {
  qualityValue.textContent = `${qualityInput.value}%`;
});

replaceButton.addEventListener("click", () => {
  fileInput.click();
});

const canvasToBlob = (mime, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("이 브라우저에서 선택한 출력 포맷을 생성할 수 없습니다."));
      },
      mime,
      quality,
    );
  });

downloadButton.addEventListener("click", async () => {
  if (!sourceImage || !sourceFile) return;

  let downloadUrl = null;

  try {
    const { width, height } = validateDimensions();
    const mime = formatSelect.value;
    const quality = Number(qualityInput.value) / 100;

    downloadButton.disabled = true;
    setStatus(`${width.toLocaleString()} × ${height.toLocaleString()} px 생성 중…`);

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: mime !== "image/jpeg" });
    if (!context) throw new Error("Canvas를 초기화할 수 없습니다.");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    if (mime === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    } else {
      context.clearRect(0, 0, width, height);
    }

    context.drawImage(sourceImage, 0, 0, width, height);
    const blob = await canvasToBlob(mime, quality);

    downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${sanitizeName(sourceFile.name)}-${width}x${height}.${getExtension(mime)}`;
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();

    setStatus(`완료 · ${formatBytes(blob.size)} · 메타데이터 제거됨`, "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "리사이즈에 실패했습니다.", "error");
  } finally {
    if (downloadUrl) window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 30_000);

    canvas.width = 1;
    canvas.height = 1;
    downloadButton.disabled = false;
  }
});

window.addEventListener("beforeunload", releaseSourceUrl);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  });
}
