const config = {
  default: {
    paths: ['features/**/*.feature'],
    import: ['tests/step-definitions/**/*.ts'],
    format: ['progress-bar', 'html:reports/cucumber-report.html'],
    formatOptions: { snippetInterface: 'async-await' },
    publishQuiet: true,
  },
};

export default config;
