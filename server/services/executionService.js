const vm = require('vm');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const execPromise = util.promisify(exec);

// Sanitize inputs roughly by escaping
const escapeCmd = (cmd) => cmd.replace(/"/g, '\\"');

exports.executeJavaScript = async (code, testCases) => {
  const logs = [];
  let passed = 0;

  const sandbox = {
    console: { log: (...args) => logs.push(args.join(' ')) }
  };
  vm.createContext(sandbox);

  try {
    vm.runInContext(code, sandbox, { timeout: 2000 });
    
    for (const test of testCases) {
      const result = vm.runInContext(`solve(${test.input})`, sandbox, { timeout: 1000 });
      const expected = JSON.parse(test.expected);
      if (JSON.stringify(result) === JSON.stringify(expected)) {
        passed++;
      } else {
        logs.push(`Test failed: solve(${test.input}) returned ${JSON.stringify(result)}, expected ${test.expected}`);
      }
    }
  } catch (err) {
    logs.push(`Execution error: ${err.message}`);
  }

  return { logs, passed, total: testCases.length };
};

exports.executePython = async (code, testCases) => {
  let wrapper = code + '\n\nimport json\npassed = 0\nlogs = []\n';
  for (const test of testCases) {
    let expected = test.expected;
    if (expected === 'true') expected = 'True';
    else if (expected === 'false') expected = 'False';
    wrapper += `
try:
    result = solve(${test.input})
    if str(result) == "${test.expected}" or result == ${expected}:
        passed += 1
    else:
        logs.append(f"Test failed: solve(${test.input}) returned {result}, expected ${test.expected}")
except Exception as e:
    logs.append(f"Error: {e}")
`;
  }
  wrapper += `
for l in logs:
    print(l)
print(f"PASSED:{passed}/${testCases.length}")
`;

  try {
    const { stdout, stderr } = await execPromise(`python -c "${escapeCmd(wrapper)}"`, { timeout: 5000 });
    if (stderr) {
      return { logs: [stderr], passed: 0, total: testCases.length };
    }
    const lines = stdout.trim().split('\n');
    const lastLine = lines[lines.length - 1] || '';
    let passed = 0;
    if (lastLine.startsWith('PASSED:')) {
      passed = parseInt(lastLine.split(':')[1].split('/')[0]);
      lines.pop();
    }
    return { logs: lines, passed, total: testCases.length };
  } catch (err) {
    return { logs: [err.message], passed: 0, total: testCases.length };
  }
};

exports.executeCpp = async (code, testCases) => {
  const fileId = crypto.randomBytes(8).toString('hex');
  const srcPath = path.join(os.tmpdir(), `temp_${fileId}.cpp`);
  const exePath = path.join(os.tmpdir(), `temp_${fileId}.exe`);

  let mainFunc = 'int main() {\n  int passed = 0;\n';
  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    mainFunc += `
  try {
    auto res = solve(${test.input});
    // Very basic equality check for C++ depending on types
    // Note: C++ templates for complex types might require more robust comparison
    if (res == ${test.expected}) { passed++; }
    else { std::cout << "Test ${i+1} failed" << std::endl; }
  } catch(...) { std::cout << "Error in test ${i+1}" << std::endl; }
`;
  }
  mainFunc += '  std::cout << "PASSED:" << passed << "/' + testCases.length + '" << std::endl;\n  return 0;\n}';

  const fullCode = `#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n${code}\n${mainFunc}`;

  try {
    fs.writeFileSync(srcPath, fullCode);
    await execPromise(`g++ "${srcPath}" -o "${exePath}"`, { timeout: 5000 });
    const { stdout, stderr } = await execPromise(`"${exePath}"`, { timeout: 5000 });
    
    // Cleanup
    fs.unlinkSync(srcPath);
    if (fs.existsSync(exePath)) fs.unlinkSync(exePath);

    if (stderr) {
      return { logs: [stderr], passed: 0, total: testCases.length };
    }
    const lines = stdout.trim().split('\n');
    const lastLine = lines[lines.length - 1] || '';
    let passed = 0;
    if (lastLine.startsWith('PASSED:')) {
      passed = parseInt(lastLine.split(':')[1].split('/')[0]);
      lines.pop();
    }
    return { logs: lines, passed, total: testCases.length };
  } catch (err) {
    if (fs.existsSync(srcPath)) fs.unlinkSync(srcPath);
    if (fs.existsSync(exePath)) fs.unlinkSync(exePath);
    return { logs: [err.message], passed: 0, total: testCases.length };
  }
};

exports.executeJava = async (code, testCases) => {
  const fileId = crypto.randomBytes(8).toString('hex');
  const className = `Solution_${fileId}`;
  const srcPath = path.join(os.tmpdir(), `${className}.java`);

  let mainFunc = `\n    public static void main(String[] args) {\n        int passed = 0;\n`;
  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    mainFunc += `
        try {
            Object res = solve(${test.input});
            if (String.valueOf(res).equals("${test.expected}")) { passed++; }
            else { System.out.println("Test ${i+1} failed"); }
        } catch(Exception e) { System.out.println("Error in test ${i+1}"); }
`;
  }
  mainFunc += `        System.out.println("PASSED:" + passed + "/${testCases.length}");\n    }\n}`;

  // Replace default class wrapper
  let fullCode = code;
  if (!fullCode.includes('public class')) {
    fullCode = `public class ${className} {\n${code}\n${mainFunc}`;
  } else {
    // Basic regex replacement for class name if they provided it
    fullCode = fullCode.replace(/public\s+class\s+\w+/, `public class ${className}`);
    fullCode = fullCode.substring(0, fullCode.lastIndexOf('}')) + mainFunc;
  }

  try {
    fs.writeFileSync(srcPath, fullCode);
    await execPromise(`javac "${srcPath}"`, { timeout: 5000 });
    const { stdout, stderr } = await execPromise(`java -cp "${os.tmpdir()}" ${className}`, { timeout: 5000 });
    
    // Cleanup
    fs.unlinkSync(srcPath);
    const classFile = srcPath.replace('.java', '.class');
    if (fs.existsSync(classFile)) fs.unlinkSync(classFile);

    if (stderr) {
      return { logs: [stderr], passed: 0, total: testCases.length };
    }
    const lines = stdout.trim().split('\n');
    const lastLine = lines[lines.length - 1] || '';
    let passed = 0;
    if (lastLine.startsWith('PASSED:')) {
      passed = parseInt(lastLine.split(':')[1].split('/')[0]);
      lines.pop();
    }
    return { logs: lines, passed, total: testCases.length };
  } catch (err) {
    if (fs.existsSync(srcPath)) fs.unlinkSync(srcPath);
    const classFile = srcPath.replace('.java', '.class');
    if (fs.existsSync(classFile)) fs.unlinkSync(classFile);
    return { logs: [err.message], passed: 0, total: testCases.length };
  }
};
