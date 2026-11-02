const ncmNorm = (value) => String(value || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

function ncmFieldTokens(value) {
  return String(value || "").split(/[,;|/]+/).map(ncmNorm).filter(Boolean);
}

function ncmWordMatch(value, target) {
  const v = ncmNorm(value), t = ncmNorm(target);
  if (!v || !t) return false;
  if (v === t) return true;
  const vt = v.split(" "), tt = t.split(" ");
  return tt.every((word) => vt.includes(word)) || v.startsWith(t + " ") || t.startsWith(v + " ");
}

// This follows the website resolver: exact covered area first, then municipality,
// then an address-area match, while retaining branches in the customer's district.
export function resolveNcmBranch(branches, { province = "", district = "", city = "", address = "" } = {}) {
  const p = ncmNorm(province);
  const d = ncmNorm(district);
  const c = ncmNorm(String(city || "").split(",")[0]);
  const a = ncmNorm(address);
  const empty = { branch: "", candidates: [], message: "" };
  if (!p || !d || !c || !Array.isArray(branches) || !branches.length) return empty;

  const geoNorm = (value) => ncmNorm(value)
    .replace(/\bprovince\b/g, "")
    .replace(/\bdistrict\b/g, "")
    .replace(/\bmetropolitan city\b/g, "")
    .replace(/\bmetropolitan\b/g, "")
    .replace(/\bmunicipality\b/g, "")
    .replace(/\bcity\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const hasMatch = (field, target) =>
    !ncmNorm(field) || geoNorm(field) === geoNorm(target) ||
    ncmWordMatch(field, target) || ncmWordMatch(target, field);

  const provinceRows = branches.filter((item) => hasMatch(item.province_name, province));
  const districtRows = provinceRows.filter((item) => hasMatch(item.district_name, district));
  const municipalityRows = districtRows.filter((item) => {
    const municipality = ncmNorm(item.municipality || item.municipality_name);
    if (municipality) return municipality === c || ncmWordMatch(municipality, c);
    return ncmFieldTokens(item.areas_covered).some((area) =>
      area === c || ncmWordMatch(area, c) || ncmWordMatch(c, area)
    );
  });
  const named = (rows) => rows
    .map((branch) => ({
      branch,
      name: String(branch.name || branch.branch_name || branch.title || branch.branch || "").trim()
    }))
    .filter((item) => item.name);

  const areaMatches = provinceRows.filter((item) => {
    if (!a) return false;
    const coversAddress = ncmFieldTokens(item.areas_covered).some((area) => {
      if (!area) return false;
      const locality = ncmNorm(area.replace(/^\s*\d+\s*[-:]\s*/, ""));
      return a === area || a === locality ||
        (" " + a + " ").includes(" " + locality + " ") ||
        ncmWordMatch(a, locality);
    });
    return coversAddress;
  });

  const districtCandidates = named([...districtRows, ...areaMatches].filter((item, index, list) =>
    list.findIndex((other) =>
      String(other.pk ?? other.code ?? other.name) === String(item.pk ?? item.code ?? item.name)
    ) === index
  ));
  const areaCandidates = named(areaMatches);
  if (areaCandidates.length === 1) {
    return {
      branch: areaCandidates[0].name,
      candidates: districtCandidates,
      message: "NCM branch matched to your delivery area. You can choose another branch in the same district."
    };
  }
  if (areaCandidates.length > 1) {
    return {
      branch: "",
      candidates: districtCandidates.length ? districtCandidates : areaCandidates,
      message: "More than one branch covers this area. Choose your preferred branch from the district list."
    };
  }

  const municipalityCandidates = named(municipalityRows);
  if (municipalityCandidates.length === 1) {
    return {
      branch: municipalityCandidates[0].name,
      candidates: districtCandidates,
      message: "NCM branch automatically selected for your municipality. You can choose another branch in the same district."
    };
  }
  if (municipalityCandidates.length > 1) {
    return {
      branch: "",
      candidates: districtCandidates.length ? districtCandidates : municipalityCandidates,
      message: "Choose the NCM branch that serves your delivery area."
    };
  }
  return {
    branch: "",
    candidates: districtCandidates,
    message: districtCandidates.length
      ? "Choose an NCM branch in your selected district."
      : "No NCM branch was found for this district. Please check the address."
  };
}
