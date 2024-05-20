import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import OpenAI from "openai"
import { z } from "zod"

const openai = new OpenAI()

// IMG_1
// [
//   {
//     "name": "ジュヴレ・シャンベルタン クロ・サン・ジャック",
//     "vintage": "2010",
//     "producer": "ルイ・ジャド"
//   },
//   {
//     "name": "ヴォーヌ・ロマネ レ・ショーム",
//     "vintage": "2021",
//     "producer": "ドメーヌ・メオ・カミュゼ"
//   },
//   {
//     "name": "シャンボール・ミュジニー レ・モンビエ",
//     "vintage": "2018",
//     "producer": "ドメーヌ・ロベール・シルグ"
//   }
// ]
//
// IMG_2
// [
//   {
//     "name": "ブルゴーニュ・パストゥグラン",
//     "vintage": "2021",
//     "producer": "エマニュエル・ルジェ"
//   },
//   {
//     "name": "シャルドネ",
//     "vintage": "2021",
//     "producer": "ワイングート・ブリュンドルマイヤー"
//   },
//   {
//     "name": "ソミュール",
//     "vintage": "2021",
//     "producer": "ドメーヌ・ギベルトー"
//   }
// ]
//
// IMG_3
// [
//   {
//     "name": "ピュリニー・モンラッシェ",
//     "vintage": "2014",
//     "producer": "エティエンヌ・ソゼ"
//   },
//   {
//     "name": "ピュリニー・モンラッシェ",
//     "vintage": "2014",
//     "producer": "ドメーヌ・ルフレーヴ"
//   }
// ]

async function readImageFile(filePath: string) {
  const baseDir = dirname(fileURLToPath(import.meta.url))

  const base64Image = await readFile(join(baseDir, filePath)).then((file) =>
    file.toString("base64"),
  )

  return base64Image
}

function validateContent(content: unknown) {
  return z
    .object({
      wines: z.array(
        z.object({
          name: z.string(),
          vintage: z.string(),
          producer: z.string(),
        }),
      ),
    })
    .safeParse(content)
}

async function main() {
  const base64Image = await readImageFile("/samples/IMG_1.jpg")

  const { wines } = await openai.chat.completions
    .create({
      messages: [
        {
          role: "system",
          content:
            'これからワインの画像を提供します。あなたの役割は、ラベルからワイン名、ヴィンテージ、生産者を抽出し、JSONフォーマットで返すことです。ワイン名と生産者は、必ず日本語で返してください。もし、ワイン名や生産者が英語やその他の言語で書かれている場合は、日本語に翻訳してから返してください。JSONの形式は以下のようにしてください: {"wines": [{"name": "ワイン名", "vintage": "ヴィンテージ", "producer": "生産者"}, ...]} JSONは、コードブロックやバッククォートで囲まないでください。',
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
      max_tokens: 1500,
      temperature: 0.3,
      top_p: 0.95,
      n: 10,
    })
    .then(({ choices: [res] }) => {
      if (!res || !res.message.content) {
        throw new Error("No response.")
      }

      const { success, error, data } = validateContent(
        JSON.parse(res.message.content),
      )

      if (!success) {
        throw new Error("Invalid response.", error)
      }

      return data
    })

  console.log(JSON.stringify(wines, null, 2))
}

main()
