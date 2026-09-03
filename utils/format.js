function toTitleCase(value = "") {
  return value
    .toString()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

module.exports = { toTitleCase };
