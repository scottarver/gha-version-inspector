const fs = require('fs');
const fetch = require('node-fetch');
const yaml = require('js-yaml');

// Get the latest version from GitHub
const getLatestVersion = async (repo) => {
    try {
        const url = `https://api.github.com/repos/${repo}/releases/latest`;
        const headers = process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {};
        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`Received HTTP ${response.status} from GitHub API`);
        }

        const data = await response.json();
        return data.tag_name;
    } catch (error) {
        console.error(`Error fetching latest version for ${repo}: ${error.message}`);
        return 'Unknown';
    }
};

// Read YAML files and count GitHub Actions usage
const readYamlFiles = () => {
  const actionUsageCount = {};

  // Filter YAML files
  const yamlFiles = fs.readdirSync('.').filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));

  yamlFiles.forEach((file) => {
    const fileContent = fs.readFileSync(file, 'utf8');
    const parsedYaml = yaml.load(fileContent);

    // Check for 'jobs' field and that it's an object
    if (parsedYaml && typeof parsedYaml.jobs === 'object') {
      Object.values(parsedYaml.jobs).forEach((job) => {
        if (Array.isArray(job.steps)) {
          job.steps.forEach((step) => {
            if (typeof step.uses === 'string') {
              actionUsageCount[step.uses] = (actionUsageCount[step.uses] || 0) + 1;
            }
          });
        }
      });
    }
  });
  return actionUsageCount;
};

// Get and compare GitHub Action versions
const getAndCompareVersions = async (actionUsageCount) => {
  const fetchPromises = Object.keys(actionUsageCount).map(async (uses) => {
    const [orgRepo, currentVersion] = uses.split('@');
    const newVersion = await getLatestVersion(orgRepo);

    // Extract major versions for comparison
    const currentMajor = currentVersion ? currentVersion.split('.')[0] : null;
    const newMajor = newVersion ? newVersion.split('.')[0] : null;

    // Check for new versions
    if (currentMajor && currentVersion.indexOf('.') === -1 && currentMajor !== newMajor) {
      return `${orgRepo.padEnd(40)}${currentVersion.padEnd(20)}${newVersion}`;
    } else if (currentVersion && currentVersion.indexOf('.') !== -1 && currentVersion !== newVersion) {
      return `${orgRepo.padEnd(40)}${currentVersion.padEnd(20)}${newVersion}`;
    }
    return null;
  });

  const results = await Promise.all(fetchPromises);
  return results.filter(result => result);
};

// Main function
const main = async () => {
  const actionUsageCount = readYamlFiles();

  // Determine the longest repo name for table formatting
  const longestRepoName = Object.keys(actionUsageCount).reduce((max, name) => Math.max(max, name.split('@')[0].length), 0);

  console.log('Name'.padEnd(longestRepoName + 2) + 'Current Version'.padEnd(20) + 'New Version');

  const versionUpdates = await getAndCompareVersions(actionUsageCount);

  if (versionUpdates.length > 0) {
    versionUpdates.forEach(update => console.log(update));
  } else {
    console.log('No new versions found.');
  }
};

main();
