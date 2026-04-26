exports.up = (pgm) => {
  pgm.dropConstraint("accounts", "accounts_registered_type_check", {
    ifExists: true,
  });
  pgm.addConstraint(
    "accounts",
    "accounts_registered_type_check",
    "CHECK (registered_type IN ('TFSA', 'RRSP', 'FHSA', 'DPSP', 'Non-registered', 'none'))",
  );
};

exports.down = (pgm) => {
  pgm.dropConstraint("accounts", "accounts_registered_type_check", {
    ifExists: true,
  });
  pgm.addConstraint(
    "accounts",
    "accounts_registered_type_check",
    "CHECK (registered_type IN ('TFSA', 'RRSP', 'FHSA', 'DPSP', 'non-registered', 'none'))",
  );
};
