import { readFile, readdir, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import OpenAI from "openai"
import { z } from "zod"

type Wine = NonNullable<ReturnType<typeof validateContent>["data"]>[number]

type WineWithEmbeddings = Wine & {
  name_embedding: number[]
  name_ja_embedding: number[]
  producer_embedding: number[]
  producer_ja_embedding: number[]
}

const openai = new OpenAI()

async function readJSONFile(filePath: string) {
  const baseDir = dirname(fileURLToPath(import.meta.url))

  return await readFile(join(baseDir, filePath))
}

function validateContent(content: unknown) {
  return z
    .array(
      z.object({
        name: z.string(),
        name_ja: z.string(),
        vintage: z.string(),
        producer: z.string(),
        producer_ja: z.string(),
        volume: z.string(),
      }),
    )
    .safeParse(content)
}

async function createEmbedding(input: string | string[]) {
  return await openai.embeddings
    .create({
      input,
      model: "text-embedding-3-small",
    })
    .then(({ data, usage }) => {
      if (usage) {
        console.info("Embeddings usage:", usage)
      }

      return data
    })
}

async function main() {
  const outputsDir = join(dirname(fileURLToPath(import.meta.url)), "/outputs")

  const filePaths = await readdir(outputsDir).then((fileNames) =>
    fileNames.map(
      (fileName) =>
        `/${relative(dirname(outputsDir), join(outputsDir, fileName))}`,
    ),
  )

  for (const [i, path] of filePaths.entries()) {
    const wines = await readJSONFile(path).then((file) => {
      const { success, error, data } = validateContent(
        JSON.parse(file.toString()),
      )

      if (!success) {
        console.error("Invalid response. error:", error)
        throw new Error("Invalid response.")
      }

      return data
    })

    const results: WineWithEmbeddings[] = []

    for (const wine of wines) {
      const [
        nameEmbedding,
        nameJaEmbedding,
        producerEmbedding,
        producerJaEmbedding,
      ] = await createEmbedding([
        wine.name,
        wine.name_ja,
        wine.producer,
        wine.producer_ja,
      ])

      results.push({
        ...wine,
        name_embedding: nameEmbedding.embedding,
        name_ja_embedding: nameJaEmbedding.embedding,
        producer_embedding: producerEmbedding.embedding,
        producer_ja_embedding: producerJaEmbedding.embedding,
      })
    }

    await writeFile(
      join(
        dirname(fileURLToPath(import.meta.url)),
        `/outputs/withEmbeddings/IMG_${i + 1}.json`,
      ),
      JSON.stringify(results, null, 2),
    )
  }
}

main()
