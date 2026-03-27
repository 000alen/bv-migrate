/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  mainSidebar: [
    'intro',
    'getting-started',
    {
      type: 'category',
      label: 'Using the Tool',
      items: [
        'usage/overview',
        'usage/extraction',
        'usage/images',
        'usage/genially',
        'usage/import',
        'usage/consolidate',
      ],
    },
    {
      type: 'category',
      label: 'Technical Reference',
      items: [
        'technical/architecture',
        'technical/circle-api',
        'technical/schema',
        'technical/testing',
        'technical/deployment',
      ],
    },
    'troubleshooting',
  ],
};

module.exports = sidebars;
