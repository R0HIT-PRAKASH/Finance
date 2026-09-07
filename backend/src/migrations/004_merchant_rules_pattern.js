exports.up = (pgm) => {
  pgm.renameColumn("merchant_rules", "merchant_name", "pattern");
};

exports.down = (pgm) => {
  pgm.renameColumn("merchant_rules", "pattern", "merchant_name");
};
