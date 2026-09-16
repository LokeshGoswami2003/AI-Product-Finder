const {
  appendFile,
  mkdir,
  readFile,
  rename,
  writeFile,
} = require("node:fs/promises");
const path = require("node:path");

async function readJsonLinesIfPresent(filePath) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
}

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

class GenerationRunStore {
  constructor(runDir) {
    this.runDir = runDir;
    this.resultsPath = path.join(runDir, "raw-results.jsonl");
    this.quarantinePath = path.join(runDir, "quarantine.jsonl");
    this.checkpointPath = path.join(runDir, "checkpoint.json");
    this.completedJobIds = new Set();
    this.succeeded = 0;
    this.unsupported = 0;
    this.quarantined = 0;
    this.totalTokens = 0;
    this.tail = Promise.resolve();
  }

  async initialize({ retryFailed = false } = {}) {
    await mkdir(this.runDir, { recursive: true });
    const [results, quarantined] = await Promise.all([
      readJsonLinesIfPresent(this.resultsPath),
      readJsonLinesIfPresent(this.quarantinePath),
    ]);
    for (const record of results) {
      this.completedJobIds.add(record.jobId);
      if (record.status === "unsupported") this.unsupported += 1;
      else this.succeeded += 1;
      this.totalTokens += Number(record.usage?.total_tokens || 0);
    }
    for (const record of quarantined) {
      if (!retryFailed) this.completedJobIds.add(record.jobId);
      this.quarantined += 1;
    }
    return this;
  }

  isComplete(jobId) {
    return this.completedJobIds.has(jobId);
  }

  serialize(operation) {
    const write = this.tail.then(operation);
    this.tail = write.catch(() => {});
    return write;
  }

  checkpoint(totalJobs) {
    return writeJsonAtomic(this.checkpointPath, {
      updatedAt: new Date().toISOString(),
      totalJobs,
      completedJobs: this.completedJobIds.size,
      succeeded: this.succeeded,
      unsupported: this.unsupported,
      quarantined: this.quarantined,
      totalTokens: this.totalTokens,
    });
  }

  appendResult(record, totalJobs) {
    return this.serialize(async () => {
      await appendFile(this.resultsPath, `${JSON.stringify(record)}\n`, "utf8");
      this.completedJobIds.add(record.jobId);
      if (record.status === "unsupported") this.unsupported += 1;
      else this.succeeded += 1;
      this.totalTokens += Number(record.usage?.total_tokens || 0);
      await this.checkpoint(totalJobs);
    });
  }

  appendQuarantine(record, totalJobs) {
    return this.serialize(async () => {
      await appendFile(
        this.quarantinePath,
        `${JSON.stringify(record)}\n`,
        "utf8",
      );
      this.completedJobIds.add(record.jobId);
      this.quarantined += 1;
      await this.checkpoint(totalJobs);
    });
  }
}

module.exports = {
  GenerationRunStore,
  readJsonLinesIfPresent,
  writeJsonAtomic,
};
