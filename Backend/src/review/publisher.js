const { createHash } = require("node:crypto");
const { mkdir, readFile, rename, rm, writeFile } = require("node:fs/promises");
const path = require("node:path");

const { compileApprovedRecords } = require("./workflow");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function jsonLinesBytes(values) {
  return Buffer.from(
    values.length > 0
      ? `${values.map((value) => JSON.stringify(value)).join("\n")}\n`
      : "",
    "utf8",
  );
}

function validateArtifactName(name) {
  if (typeof name !== "string" || path.basename(name) !== name) {
    throw new Error(`Unsafe artifact filename: ${name}`);
  }
}

async function prepareRelease({ corpus, reviewRecords, now = new Date() }) {
  const compiled = compileApprovedRecords({ corpus, reviewRecords });
  const files = {};
  for (const [key, name] of Object.entries(corpus.manifest.files || {})) {
    if (["answers", "questions", "report"].includes(key)) continue;
    validateArtifactName(name);
    files[name] = await readFile(path.join(corpus.releaseDir, name));
  }
  files["answers.jsonl"] = jsonLinesBytes(compiled.answers);
  files["questions.jsonl"] = jsonLinesBytes(compiled.questions);

  const decisionsHash = sha256(jsonLinesBytes(reviewRecords));
  const createdAt = now.toISOString();
  const releaseHash = sha256(
    Buffer.concat([
      Buffer.from(corpus.manifest.releaseId),
      files["answers.jsonl"],
      files["questions.jsonl"],
      Buffer.from(decisionsHash),
    ]),
  );
  const releaseId = `${createdAt.replace(/[-:.]/g, "")}-${releaseHash.slice(0, 8)}`;
  const report = {
    ...corpus.report,
    offlineAnswerStatus: "reviewed",
    approvedAnswerCount: compiled.answers.length,
    approvedQuestionCount: compiled.questions.length,
    reviewPromotion: {
      baseReleaseId: corpus.manifest.releaseId,
      approvedCount: compiled.approvedCount,
      rejectedCount: compiled.rejectedCount,
      replacedCount: compiled.replacedCount,
    },
  };
  files["report.json"] = jsonBytes(report);
  const fileHashes = Object.fromEntries(
    Object.entries(files).map(([name, bytes]) => [name, sha256(bytes)]),
  );
  const manifest = {
    ...corpus.manifest,
    releaseId,
    createdAt,
    files: {
      ...corpus.manifest.files,
      answers: "answers.jsonl",
      questions: "questions.jsonl",
      report: "report.json",
    },
    offline: {
      formatVersion: 1,
      baseReleaseId: corpus.manifest.releaseId,
      decisionsSha256: decisionsHash,
      fileSha256: fileHashes,
    },
  };
  return { compiled, files, manifest, report, releaseId };
}

async function publishReviewedRelease({
  artifactDir,
  corpus,
  reviewRecords,
  dryRun = false,
  activate = false,
  now = new Date(),
}) {
  const prepared = await prepareRelease({ corpus, reviewRecords, now });
  if (dryRun) {
    return {
      ...prepared,
      releaseDir: null,
      activated: false,
      dryRun: true,
    };
  }

  const releasesDir = path.join(artifactDir, "releases");
  const releaseDir = path.join(releasesDir, prepared.releaseId);
  const temporaryDir = `${releaseDir}.tmp`;
  await mkdir(releasesDir, { recursive: true });
  try {
    await readFile(path.join(releaseDir, "manifest.json"));
    throw new Error(`Release already exists: ${prepared.releaseId}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await rm(temporaryDir, { recursive: true, force: true });
  await mkdir(temporaryDir);
  try {
    await Promise.all(
      Object.entries(prepared.files).map(([name, bytes]) =>
        writeFile(path.join(temporaryDir, name), bytes),
      ),
    );
    await writeFile(
      path.join(temporaryDir, "manifest.json"),
      jsonBytes(prepared.manifest),
    );
    await rename(temporaryDir, releaseDir);
    if (activate) {
      const pointerPath = path.join(artifactDir, "current.json");
      const temporaryPointerPath = `${pointerPath}.tmp`;
      await writeFile(
        temporaryPointerPath,
        jsonBytes({ releaseId: prepared.releaseId }),
      );
      await rename(temporaryPointerPath, pointerPath);
    }
    return {
      ...prepared,
      releaseDir,
      activated: activate,
      dryRun: false,
    };
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  }
}

module.exports = {
  jsonBytes,
  jsonLinesBytes,
  prepareRelease,
  publishReviewedRelease,
  sha256,
  validateArtifactName,
};
