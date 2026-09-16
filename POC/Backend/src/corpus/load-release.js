const { readFile } = require("node:fs/promises");
const path = require("node:path");

const { normalizeQuery } = require("../offline/normalization");
const { answerSchema, questionSchema } = require("../offline/schema");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonLines(filePath, schema) {
  const text = await readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      try {
        return schema.parse(JSON.parse(line));
      } catch (error) {
        throw new Error(
          `Invalid offline record at ${path.basename(filePath)}:${index + 1}`,
          { cause: error },
        );
      }
    });
}

function validateOfflineReferences(products, answers, questions) {
  const knownFgmns = new Set(products.map((product) => String(product.fgmn)));
  const answersById = new Map();
  for (const answer of answers) {
    if (answersById.has(answer.answerId)) {
      throw new Error(`Duplicate offline answer ID: ${answer.answerId}`);
    }
    for (const fgmn of answer.fgmns) {
      if (!knownFgmns.has(String(fgmn))) {
        throw new Error(
          `Offline answer ${answer.answerId} references unknown FGMN ${fgmn}`,
        );
      }
    }
    answersById.set(answer.answerId, answer);
  }
  const questionIds = new Set();
  const normalizedQuestions = new Map();
  for (const question of questions) {
    if (questionIds.has(question.questionId)) {
      throw new Error(`Duplicate offline question ID: ${question.questionId}`);
    }
    if (!answersById.has(question.answerId)) {
      throw new Error(
        `Offline question ${question.questionId} references unknown answer ${question.answerId}`,
      );
    }
    const normalized = normalizeQuery(question.normalizedText || question.text);
    const existing = normalizedQuestions.get(normalized);
    if (existing && existing !== question.answerId) {
      throw new Error(
        `Offline question text maps to conflicting answers: ${normalized}`,
      );
    }
    normalizedQuestions.set(normalized, question.answerId);
    questionIds.add(question.questionId);
  }
}

async function loadActiveRelease(artifactDir) {
  const pointer = await readJson(path.join(artifactDir, "current.json"));
  const releaseDir = path.join(artifactDir, "releases", pointer.releaseId);
  const [manifest, products, report] = await Promise.all([
    readJson(path.join(releaseDir, "manifest.json")),
    readJson(path.join(releaseDir, "products.json")),
    readJson(path.join(releaseDir, "report.json")),
  ]);

  if (manifest.releaseId !== pointer.releaseId) {
    throw new Error(
      "Active corpus pointer does not match its release manifest",
    );
  }

  if (!Array.isArray(products) || products.length === 0) {
    throw new Error("Active catalog is missing products");
  }

  const answers = manifest.files?.answers
    ? await readJsonLines(
        path.join(releaseDir, manifest.files.answers),
        answerSchema,
      )
    : [];
  const questions = manifest.files?.questions
    ? await readJsonLines(
        path.join(releaseDir, manifest.files.questions),
        questionSchema,
      )
    : [];
  validateOfflineReferences(products, answers, questions);

  return {
    releaseDir,
    manifest,
    products,
    answers,
    questions,
    report,
  };
}

module.exports = {
  loadActiveRelease,
  readJsonLines,
  validateOfflineReferences,
};
