# Truth Timeline

**A community-driven decision visualization system that maps personal and collective realities through yes/no choices.**

## What is This?

Truth Timeline creates a navigable multiverse where your votes construct your unique reality path. Each decision branches into yes/no paths, forming a 3D space of bubbles where:

- **Your votes = Your reality** (you can't be in both yes and no states)
- **Other people's timelines are visible but grayed out** (parallel universes you can see but aren't in)
- **Bubble size = community engagement** (how many people voted on this decision)
- **Retroactive voting allowed** (change past votes, recalculate your timeline)
- **Projects handle complexity** (when yes/no isn't enough)

## The Big Idea

Starting from foundational questions like "I think therefore I am", communities build up an ontological graph of decisions. Each person's unique series of yes/no votes creates their personal timeline through this shared decision space.

When you change a past vote, downstream decisions get invalidated—**unless** alternate paths exist to reach them (path redundancy in a DAG structure).

## Quick Example

```
[Should we build the highway?]
       /              \
     YES              NO
  (your path)    (grayed out)
      |                |
[Toll road?]    [Build rail?]
```

Your yes/no votes determine which branch you're on. Others might be on different branches—their reality, not yours.

## Quick Start

### 📱 Web Version (Recommended for Phone)

```bash
# Install dependencies
pip install -r requirements.txt

# Run web server
./run.sh

# Access at http://localhost:8000
```

**Deploy to the web**: See **[DEPLOYMENT.md](DEPLOYMENT.md)** for Railway, Replit, Render, etc.

**Perfect for mobile**: Responsive design, add to home screen for app-like experience!

### 💻 CLI Version

```bash
# Run the interactive CLI
python3 src/cli.py

# Or with a specific user ID
python3 src/cli.py alice
```

**No dependencies needed!** Uses Python 3.7+ standard library and SQLite.

**[→ Full usage guide](USAGE.md)**

## Documentation

**[→ Deployment guide](DEPLOYMENT.md)** - Deploy to Railway, Replit, Render (for phone access!)
**[→ Conceptual foundation](CONCEPT.md)** - Deep dive into philosophy and mechanics
**[→ Usage guide](USAGE.md)** - CLI getting started and walkthrough
**[→ Data model](DATA_MODEL.md)** - Database schema and scalability

Key concepts:
- Personal reality construction
- The ontological bootstrap problem
- Timeline invalidation & path redundancy
- 3D bubble visualization (coming soon)
- Historical truth & future data integration

## Status

**✅ Web App Complete** - Mobile-friendly interface + CLI

Features implemented:
- 📱 **Mobile-first web interface** (works on any phone browser)
- 💻 **Command-line interface** (for local/offline use)
- ✅ Define terms through yes/no questions
- ✅ Vote on personal and community definitions
- 🤖 AI-powered suggestion engine
- 📜 Timeline tracking and visualization
- ⚠️ Orphaned node detection
- 📊 Scalable data model (SQLite → PostgreSQL path)
- 🎨 Dark theme, touch-optimized UI
- 🚀 Deploy-ready (Railway, Replit, Render, etc.)

Coming soon:
- 🌌 3D bubble visualization
- 📥 Real-world historical data import
- 🧠 Advanced AI suggestions (LLM integration)
- 📁 Project spaces for complex topics

---

**Vision**: Map the decision space of human thought, making visible the branching realities we create through our choices.