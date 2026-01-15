const tokenFileInput = document.getElementById("tokenFile");
const fileStatus = document.getElementById("fileStatus");
const platformFilters = document.getElementById("platformFilters");
const sizeFilters = document.getElementById("sizeFilters");
const groupFilters = document.getElementById("groupFilters");
const output = document.getElementById("output");
const totalCount = document.getElementById("totalCount");
const filteredCount = document.getElementById("filteredCount");
const previewList = document.getElementById("previewList");
const searchInput = document.getElementById("searchInput");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const sampleBtn = document.getElementById("sampleBtn");

const SIZE_LABELS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const SAMPLE_URL =
  "https://raw.githubusercontent.com/gokhankurt/design-system-updates/releases/variables_4-7-11.json";

let allTokens = [];
let filters = {
  platforms: new Set(),
  sizes: new Set(),
  groups: new Set(),
  search: "",
};

const normalize = (value) => String(value || "").trim().toLowerCase();

const flattenTokens = (node, path = []) => {
  const results = [];
  if (!node || typeof node !== "object") {
    return results;
  }

  if (Array.isArray(node)) {
    node.forEach((entry, index) => {
      if (entry && typeof entry === "object" && typeof entry.name === "string") {
        const segments = entry.name.split(/[./]/).filter(Boolean);
        results.push(...flattenTokens(entry, [...path, ...segments]));
      } else {
        results.push(...flattenTokens(entry, [...path, String(index)]));
      }
    });
    return results;
  }

  const hasValue =
    Object.prototype.hasOwnProperty.call(node, "value") ||
    Object.prototype.hasOwnProperty.call(node, "$value");
  const hasType =
    Object.prototype.hasOwnProperty.call(node, "type") ||
    Object.prototype.hasOwnProperty.call(node, "$type");
  const isLeaf = hasValue || hasType;

  if (isLeaf) {
    const token = {
      path,
      name: path.join("."),
      value: node.value ?? node.$value ?? node,
      raw: node,
      attributes: node.attributes ?? node.$extensions?.attributes ?? {},
    };
    results.push(token);
    return results;
  }

  Object.entries(node).forEach(([key, value]) => {
    results.push(...flattenTokens(value, [...path, key]));
  });

  return results;
};

const uniqueFromTokens = (tokens, getter) =>
  Array.from(
    tokens.reduce((acc, token) => {
      getter(token).forEach((entry) => acc.add(entry));
      return acc;
    }, new Set())
  ).sort((a, b) => a.localeCompare(b));

const extractPlatforms = (token) => {
  const fromAttributes = token.attributes?.platform;
  const fromExtensions =
    token.raw?.extensions?.platforms || token.raw?.$extensions?.platforms;
  const fromDirect = token.raw?.platforms;
  const entries = [fromAttributes, fromExtensions, fromDirect]
    .flat()
    .filter(Boolean)
    .map((entry) => String(entry));
  return entries.length ? entries : ["All"];
};

const extractSizes = (token) => {
  const segments = token.path.map((entry) => String(entry).toUpperCase());
  return SIZE_LABELS.filter((size) => segments.includes(size));
};

const extractGroup = (token) => {
  return token.path[0] ? String(token.path[0]) : "Ungrouped";
};

const renderChips = (container, items, selected, label) => {
  container.innerHTML = "";
  items.forEach((item) => {
    const chip = document.createElement("label");
    chip.className = "chip";
    chip.dataset.active = selected.has(item) ? "true" : "false";
    chip.textContent = item;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = item;
    input.checked = selected.has(item);

    input.addEventListener("change", () => {
      if (input.checked) {
        selected.add(item);
      } else {
        selected.delete(item);
      }
      chip.dataset.active = input.checked ? "true" : "false";
      applyFilters();
    });

    chip.prepend(input);
    container.appendChild(chip);
  });

  if (!items.length) {
    const empty = document.createElement("p");
    empty.textContent = `No ${label} found in file.`;
    empty.className = "muted";
    container.appendChild(empty);
  }
};

const applyFilters = () => {
  if (allTokens.length === 0) {
    totalCount.textContent = "0";
    filteredCount.textContent = "0";
    output.textContent =
      "No tokens found yet. Load a JSON file or try the GitHub sample.";
    previewList.innerHTML = "<li class=\"muted\">No tokens to preview.</li>";
    copyBtn.disabled = true;
    downloadBtn.disabled = true;
    return;
  }

  const filtered = allTokens.filter((token) => {
    const tokenPlatforms = extractPlatforms(token);
    const tokenSizes = extractSizes(token);
    const tokenGroup = extractGroup(token);

    const platformMatch =
      !filters.platforms.size ||
      tokenPlatforms.some((platform) => filters.platforms.has(platform));
    const sizeMatch =
      !filters.sizes.size || tokenSizes.some((size) => filters.sizes.has(size));
    const groupMatch =
      !filters.groups.size || filters.groups.has(tokenGroup);

    const searchMatch =
      !filters.search ||
      normalize(token.name).includes(filters.search) ||
      normalize(tokenGroup).includes(filters.search);

    return platformMatch && sizeMatch && groupMatch && searchMatch;
  });

  totalCount.textContent = allTokens.length.toString();
  filteredCount.textContent = filtered.length.toString();

  const reduced = buildReducedTokenTree(filtered);
  output.textContent = JSON.stringify(reduced, null, 2);
  renderPreview(filtered);

  const disabled = filtered.length === 0;
  copyBtn.disabled = disabled;
  downloadBtn.disabled = disabled;
};

const renderPreview = (tokens) => {
  previewList.innerHTML = "";
  if (tokens.length === 0) {
    previewList.innerHTML = "<li class=\"muted\">No tokens match the filters.</li>";
    return;
  }

  tokens.slice(0, 20).forEach((token) => {
    const item = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = token.name;
    const value = document.createElement("span");
    value.textContent = JSON.stringify(token.value);
    item.appendChild(name);
    item.appendChild(value);
    previewList.appendChild(item);
  });
};

const buildReducedTokenTree = (tokens) => {
  const tree = {};
  tokens.forEach((token) => {
    let cursor = tree;
    token.path.forEach((segment, index) => {
      if (!cursor[segment]) {
        cursor[segment] = {};
      }
      if (index === token.path.length - 1) {
        cursor[segment] = token.raw;
      } else {
        cursor = cursor[segment];
      }
    });
  });
  return tree;
};

const updateFilters = () => {
  const platformOptions = uniqueFromTokens(allTokens, extractPlatforms);
  const sizeOptions = uniqueFromTokens(allTokens, extractSizes);
  const groupOptions = uniqueFromTokens(allTokens, (token) => [extractGroup(token)]);

  filters.platforms = new Set(platformOptions);
  filters.sizes = new Set(sizeOptions);
  filters.groups = new Set(groupOptions);

  renderChips(platformFilters, platformOptions, filters.platforms, "platforms");
  renderChips(sizeFilters, sizeOptions, filters.sizes, "sizes");
  renderChips(groupFilters, groupOptions, filters.groups, "groups");

  applyFilters();
};

const handleParsedTokens = (parsed, label) => {
  const tokenRoot = parsed.tokens ?? parsed;
  allTokens = flattenTokens(tokenRoot);
  if (allTokens.length === 0) {
    fileStatus.textContent =
      `Loaded ${label}, but no tokens were detected. Check the file format.`;
  } else {
    fileStatus.textContent = `Loaded ${label} (${allTokens.length} tokens)`;
  }
  updateFilters();
};

const handleFile = (file) => {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      handleParsedTokens(parsed, file.name);
    } catch (error) {
      fileStatus.textContent = "Unable to parse JSON file.";
      allTokens = [];
      updateFilters();
    }
  };
  reader.readAsText(file);
};

searchInput.addEventListener("input", (event) => {
  filters.search = normalize(event.target.value);
  applyFilters();
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(output.textContent);
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy JSON";
    }, 1500);
  } catch (error) {
    copyBtn.textContent = "Copy failed";
  }
});

downloadBtn.addEventListener("click", () => {
  const blob = new Blob([output.textContent], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "reduced-tokens.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
});

tokenFileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  handleFile(file);
});

sampleBtn.addEventListener("click", async () => {
  try {
    sampleBtn.disabled = true;
    sampleBtn.textContent = "Loading sample...";
    const response = await fetch(SAMPLE_URL);
    if (!response.ok) {
      throw new Error("Failed to fetch sample file.");
    }
    const parsed = await response.json();
    handleParsedTokens(parsed, "variables_4-7-11.json");
  } catch (error) {
    fileStatus.textContent =
      "Unable to load the sample file. Check your connection and try again.";
    output.textContent = "Sample load failed. Try uploading a JSON file instead.";
  } finally {
    sampleBtn.disabled = false;
    sampleBtn.textContent = "Load sample from GitHub";
  }
});

output.textContent = "Upload a JSON file to preview your reduced tokens.";
copyBtn.disabled = true;
downloadBtn.disabled = true;
