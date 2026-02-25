from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import datasets, models, explanations, exploration, configurations

app = FastAPI(
    title="Material Design Intelligence (MDI)",
    description="AI-assisted material design platform - MVP",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router)
app.include_router(models.router)
app.include_router(explanations.router)
app.include_router(exploration.router)
app.include_router(configurations.router)


@app.get("/")
def root():
    return {"message": "MDI API v0.2.0", "docs": "/docs"}
