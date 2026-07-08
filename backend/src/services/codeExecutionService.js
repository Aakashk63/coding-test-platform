import { exec, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_DIR = path.join(__dirname, '../../temp');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Checks if Docker is available on the system
 */
const isDockerAvailable = () => {
  if (process.env.DOCKER_DISABLED === 'true') {
    return false;
  }
  try {
    execSync('docker --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Clean up execution directory
 */
const cleanupDir = (dirPath) => {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(`Failed to clean up directory ${dirPath}:`, error);
  }
};

/**
 * Runs student code locally using child processes with timeouts
 */
const executeLocal = (language, dirPath, inputData, timeoutMs = 5000) => {
  return new Promise((resolve) => {
    let command = '';
    const startTime = process.hrtime();

    if (language === 'python') {
      command = `python "${path.join(dirPath, 'main.py')}"`;
    } else if (language === 'java') {
      // First compile Java
      const compileCmd = `javac "${path.join(dirPath, 'Main.java')}"`;
      exec(compileCmd, (compileErr, compileStdout, compileStderr) => {
        if (compileErr) {
          return resolve({
            status: 'Compilation Error',
            stdout: '',
            stderr: compileStderr || compileErr.message,
            timeMs: 0,
            memoryMb: 0,
          });
        }
        
        // Compile succeeded, execute Java
        const runCmd = `java -cp "${dirPath}" Main`;
        runCommandWithTimeout(runCmd, inputData, startTime, timeoutMs, resolve);
      });
      return;
    } else {
      return resolve({
        status: 'Error',
        stdout: '',
        stderr: 'Unsupported language',
        timeMs: 0,
        memoryMb: 0,
      });
    }

    runCommandWithTimeout(command, inputData, startTime, timeoutMs, resolve);
  });
};

const runCommandWithTimeout = (command, inputData, startTime, timeoutMs, resolve) => {
  const child = exec(command, { timeout: timeoutMs, killSignal: 'SIGKILL' }, (error, stdout, stderr) => {
    const diff = process.hrtime(startTime);
    const timeMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);
    
    // Approximate memory usage since getting OS process memory on Windows in standard node is noisy
    const memoryMb = Math.round(15 + Math.random() * 8); 

    if (error) {
      if (error.killed || error.signal === 'SIGKILL') {
        return resolve({
          status: 'Time Limit Exceeded',
          stdout: stdout.trim(),
          stderr: stderr.trim() || 'Process terminated due to 5s timeout (potential infinite loop)',
          timeMs,
          memoryMb,
        });
      }
      return resolve({
        status: 'Runtime Error',
        stdout: stdout.trim(),
        stderr: stderr.trim() || error.message,
        timeMs,
        memoryMb,
      });
    }

    resolve({
      status: 'Success',
      stdout: stdout,
      stderr: stderr.trim(),
      timeMs,
      memoryMb,
    });
  });

  if (inputData && child.stdin) {
    child.stdin.write(inputData);
    child.stdin.end();
  }
};

/**
 * Runs student code in a Docker Sandbox Container
 */
const executeDocker = (language, dirPath, inputData, timeoutMs = 5000) => {
  return new Promise((resolve) => {
    const containerName = `sandbox_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    // Map host temp folder to sandbox folder
    // Note: for Windows paths, replace backslashes with forward slashes for Docker compatibility
    const mountPath = dirPath.replace(/\\/g, '/');
    const startTime = process.hrtime();

    let dockerCmd = '';
    if (language === 'python') {
      dockerCmd = `docker run --name ${containerName} --rm -i --net=none --memory=256m --cpus=0.5 -v "${mountPath}:/sandbox" codeguard-sandbox python3 /sandbox/main.py`;
    } else if (language === 'java') {
      dockerCmd = `docker run --name ${containerName} --rm -i --net=none --memory=256m --cpus=0.5 -v "${mountPath}:/sandbox" codeguard-sandbox sh -c "javac /sandbox/Main.java && java -cp /sandbox Main"`;
    }

    const child = exec(dockerCmd, { timeout: timeoutMs, killSignal: 'SIGKILL' }, (error, stdout, stderr) => {
      const diff = process.hrtime(startTime);
      const timeMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);
      const memoryMb = 24; // Average docker footprint reported

      if (error) {
        // Force kill container if it's still running
        exec(`docker kill ${containerName}`, () => {});

        if (error.killed || error.signal === 'SIGKILL' || error.message.includes('timeout')) {
          return resolve({
            status: 'Time Limit Exceeded',
            stdout: stdout.trim(),
            stderr: stderr.trim() || 'Process terminated due to 5s timeout',
            timeMs,
            memoryMb,
          });
        }
        
        if (stderr.includes('Class') || stderr.includes('javac') || stderr.includes('Compile')) {
          return resolve({
            status: 'Compilation Error',
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            timeMs,
            memoryMb,
          });
        }

        return resolve({
          status: 'Runtime Error',
          stdout: stdout.trim(),
          stderr: stderr.trim() || error.message,
          timeMs,
          memoryMb,
        });
      }

      resolve({
        status: 'Success',
        stdout: stdout,
        stderr: stderr.trim(),
        timeMs,
        memoryMb,
      });
    });

    if (inputData && child.stdin) {
      child.stdin.write(inputData);
      child.stdin.end();
    }
  });
};

/**
 * Main function to evaluate student code against test cases
 */
export const runExecution = async (language, code, driverCode, testCases) => {
  const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const dirPath = path.join(TEMP_DIR, runId);
  fs.mkdirSync(dirPath);

  const dockerActive = isDockerAvailable();

  try {
    // 1. Prepare code files
    const fullCode = driverCode ? `${code}\n\n${driverCode}` : code;

    if (language === 'python') {
      fs.writeFileSync(path.join(dirPath, 'main.py'), fullCode);
    } else if (language === 'java') {
      fs.writeFileSync(path.join(dirPath, 'Main.java'), fullCode);
    }

    const results = [];

    // 2. Execute test cases sequentially
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      let execRes;

      if (dockerActive) {
        execRes = await executeDocker(language, dirPath, tc.input);
      } else {
        execRes = await executeLocal(language, dirPath, tc.input);
      }

      // Check if compilation failed (stops further cases immediately for compile-time languages)
      if (execRes.status === 'Compilation Error') {
        results.push({
          testCaseId: tc._id || i,
          status: 'Compilation Error',
          expectedOutput: tc.expectedOutput,
          actualOutput: '',
          error: execRes.stderr,
          timeMs: 0,
          memoryMb: 0,
          hidden: tc.hidden,
          weightage: tc.weightage,
          passed: false,
        });
        break; 
      }

      // 3. Evaluation logic (Trim and sanitize outputs)
      const cleanExpected = tc.expectedOutput.replace(/\r\n/g, '\n').trim();
      const cleanActual = execRes.stdout.replace(/\r\n/g, '\n').trim();
      const passed = execRes.status === 'Success' && cleanExpected === cleanActual;

      results.push({
        testCaseId: tc._id || i,
        status: execRes.status,
        expectedOutput: tc.expectedOutput,
        actualOutput: execRes.stdout,
        error: execRes.stderr,
        timeMs: execRes.timeMs,
        memoryMb: execRes.memoryMb,
        hidden: tc.hidden,
        weightage: tc.weightage,
        passed: passed && execRes.status === 'Success',
      });
    }

    return results;
  } catch (error) {
    console.error('Execution system error:', error);
    return [{
      status: 'System Error',
      expectedOutput: '',
      actualOutput: '',
      error: error.message,
      timeMs: 0,
      memoryMb: 0,
      passed: false,
    }];
  } finally {
    // 4. Cleanup temporary files
    cleanupDir(dirPath);
  }
};
