module.exports = {
  extends: "stylelint-config-standard",
  rules: {
    // Design system usa blocos single-line com múltiplas declarações por compacidade
    "declaration-block-single-line-max-declarations": null,
    // Fontes são definidas em variáveis CSS (--font-sans) e usadas via var() —
    // fallback genérico no ponto de uso, não na definição da variável
    "font-family-no-missing-generic-family-keyword": null,
  }
};
