import { readFile, readdir, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import OpenAI from "openai"
import { z } from "zod"

const openai = new OpenAI()

async function readImageFile(filePath: string) {
  const baseDir = dirname(fileURLToPath(import.meta.url))

  return await readFile(join(baseDir, filePath))
}

function validateContent(content: unknown) {
  return z
    .object({
      wines: z.array(
        z.object({
          name: z.string(),
          name_ja: z.string(),
          vintage: z.string(),
          producer: z.string(),
          producer_ja: z.string(),
          volume: z.string(),
        }),
      ),
    })
    .safeParse(content)
}

async function main() {
  const inputsDir = join(dirname(fileURLToPath(import.meta.url)), "/inputs")

  const filePaths = await readdir(inputsDir).then((fileNames) =>
    fileNames.map(
      (fileName) =>
        `/${relative(dirname(inputsDir), join(inputsDir, fileName))}`,
    ),
  )

  for (const [i, path] of filePaths.entries()) {
    const base64Image = await readImageFile(path).then((file) =>
      file.toString("base64"),
    )

    const { wines } = await openai.chat.completions
      .create({
        messages: [
          {
            role: "system",
            content:
              'これからワイン画像を提供します。ラベルからワイン名、生産者、ヴィンテージ、容量を抽出し、JSONで返してください。ヴィンテージがある場合は、ワイン名に生産者とヴィンテージを含め、"生産者 ワイン名 ヴィンテージ" の形式で日本語と原語の両方を返してください。ヴィンテージがない場合は、ワイン名に生産者のみを含め、"生産者 ワイン名" の形式で返してください。容量が750ml以外の場合、ワイン名に "ハーフ" や "マグナム" 等の表記を追加してください。生産者名も日本語と原語の両方を返してください。ヴィンテージがある場合はヴィンテージを、ない場合は "N.V." を返してください。容量は別途 "volume" フィールドに記載してください。JSONフォーマット: {"wines": [{"name": "原語のワイン名（容量表記を含む）", "name_ja": "日本語のワイン名（容量表記を含む）", "vintage": "ヴィンテージ または N.V.", "producer": "原語の生産者名", "producer_ja": "日本語の生産者名", "volume": "容量"}, ...]}',
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        model: "gpt-4o-2024-05-13",
        response_format: { type: "json_object" },
        temperature: 0.3,
        top_p: 0.95,
        n: 10,
      })
      .then(({ choices: [res], usage }) => {
        if (usage) {
          console.info("Chat completion usage:", usage)
        }

        if (!res || !res.message.content) {
          throw new Error("No response.")
        }

        const { success, error, data } = validateContent(
          JSON.parse(res.message.content),
        )

        if (!success) {
          console.error("Invalid response. error:", error)
          throw new Error("Invalid response.")
        }

        return data
      })

    await writeFile(
      join(
        dirname(fileURLToPath(import.meta.url)),
        `/outputs/IMG_${i + 1}.json`,
      ),
      JSON.stringify(wines, null, 2),
    )
  }
}

main()
