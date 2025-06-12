// Zapier wrapper for test zapier-planfix.js
import path from 'path';
import {promises as fs} from 'fs';
import {fileURLToPath} from 'url';
import process from 'process';
import fetch from 'node-fetch';

const scriptName = 'zapier-amocrm-webhook-lead';

// private chat
if (!process.env.ZAPIER_INPUT_AMOCRM) throw new Error("ZAPIER_INPUT_AMOCRM is required");
const inputData = JSON.parse(process.env.ZAPIER_INPUT_AMOCRM);

// console.log(JSON.stringify(inputData));

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to run search-planfix-task.js in a debuggable way
async function runZapierTest(inputData) {
  try {
    // Path to the original script
    const scriptPath = path.join(__dirname, `${scriptName}.js`);

    // Read the script content
    const scriptContent = await fs.readFile(scriptPath, 'utf8');

    // Create a temporary debuggable file that's a direct copy for debugging
    const debugFilePath = path.join(__dirname, `${scriptName}.debug.js`);

    // Create a wrapper that will make the script "debuggable" by directly copying it
    // and just adding an export wrapper around it
    const debuggableScript = `// This is a debuggable version of search-planfix-task.js
// It exports a function that can be called with input data

export default async function execute(inputDataParam, fetchParam) {
  // Define the inputData and fetch that the original script expects
  const inputData = inputDataParam;
  const fetch = fetchParam;

  // Below is the exact content of search-planfix-task.js
  // No indentation or modifications to preserve line numbers exactly
${scriptContent}

  // Return the result from the last line of the original script
}`;

    // Write the debuggable file
    await fs.writeFile(debugFilePath, debuggableScript, 'utf8');

    try {
      // Import the debuggable module
      const importPath = `./${scriptName}.debug.js?t=${Date.now()}`;
      const {default: executeFn} = await import(importPath);

      // Execute the function with the provided data
      const result = await executeFn(inputData, global.fetch || fetch);
      console.log(JSON.stringify(result, null, 2));
      const outputFilePath = path.join(__dirname, `${scriptName}.output.json`);
      await fs.writeFile(outputFilePath, JSON.stringify(result, null, 2));
      console.log('Output file created at:', outputFilePath);
      return result;
    } finally {
      // Don't delete the debug file to allow for continued debugging
      console.log('Debuggable file created at:', debugFilePath);
    }
  } catch (error) {
    console.error(`Error running ${scriptName}.js:`, error);
    return {error: error.message};
  }
}

await runZapierTest(inputData);
