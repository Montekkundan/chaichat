import { NextResponse } from "next/server"
import { getAllModels, refreshModelsCache } from "~/lib/models"

export async function GET() {
  try {
    const models = await getAllModels()
    
    return Response.json({
      models: models.map(model => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
        providerId: model.providerId,
        modelFamily: model.modelFamily,
        description: model.description,
        tags: model.tags,
        contextWindow: model.contextWindow,
        inputCost: model.inputCost,
        outputCost: model.outputCost,
        priceUnit: model.priceUnit,
        vision: model.vision,
        tools: model.tools,
        audio: model.audio,
        openSource: model.openSource,
        speed: model.speed,
      }))
    })
  } catch (error) {
    console.error("Failed to load models:", error)
    return Response.json({ error: "Failed to load models" }, { status: 500 })
  }
}

export async function POST() {
  try {
    // Refresh the models cache
    refreshModelsCache()
    const models = await getAllModels()
    
    return NextResponse.json({
      message: "Models cache refreshed",
      models,
      timestamp: new Date().toISOString(),
      count: models.length,
    })
  } catch (error) {
    console.error("Failed to refresh models:", error)
    return NextResponse.json(
      { error: "Failed to refresh models" },
      { status: 500 }
    )
  }
} 