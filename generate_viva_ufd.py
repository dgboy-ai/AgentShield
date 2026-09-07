import urllib.parse
import urllib.request
import os

docs_dir = r"C:\projects\AgentShield\docs"
os.makedirs(docs_dir, exist_ok=True)

# USER FLOW DIAGRAM (UFD)
ufd_dot = """
digraph UFD {
    graph [label="User Flow Diagram (UFD): AgentShield Frontend", labelloc="t", fontsize=16, fontname="Arial"];
    rankdir=TB;
    splines=true;
    nodesep=0.8;
    ranksep=1.0;
    
    node [fontname="Arial", fontsize=12, penwidth=2];
    edge [fontname="Arial", fontsize=10];

    // Actors (Circles)
    node [shape=ellipse, style=filled, fillcolor="#e9ecef"];
    Dev [label="Developer\\n(User)"];
    Owner [label="Security\\nOwner"];
    LLM [label="LLM Agent\\n(API Client)"];

    // UI Screens (Notes)
    node [shape=note, style=filled, fillcolor="#fff3cd"];
    Landing [label="Landing Page\\n(/)"];
    UserLogin [label="User Auth\\n(/login)"];
    OwnerLogin [label="Owner Auth\\n(/owner)"];
    UserDash [label="Developer Dashboard\\n(/dashboard)"];
    OwnerDash [label="Owner Dashboard\\n(/owner/dashboard)"];

    // System Actions (Rounded Boxes)
    node [shape=box, style="rounded,filled", fillcolor="#d1e7dd"];
    GenerateKey [label="Generate API Key"];
    ViewMemories [label="View Cryptographic\\nMemories & Receipts"];
    SetConstraints [label="Define Security\\nConstraints (Pinning)"];
    ViewAudits [label="View Audit Logs &\\nCompliance Reports"];
    SubmitPayload [label="Submit Raw\\nMemory Payload"];

    // Flows
    Dev -> Landing [label=" visits public URL "];
    Landing -> UserLogin [label=" clicks Log In "];
    
    Owner -> OwnerLogin [label=" visits hidden URL\\n(/owner) "];
    
    UserLogin -> UserDash [label=" email & pass "];
    OwnerLogin -> OwnerDash [label=" master pass "];

    UserDash -> GenerateKey [label=" provisions "];
    UserDash -> ViewMemories [label=" monitors "];

    OwnerDash -> SetConstraints [label=" manages policies "];
    OwnerDash -> ViewAudits [label=" monitors compliance "];

    LLM -> SubmitPayload [label=" API POST /memories\\n(using API Key) "];
    SubmitPayload -> ViewMemories [label=" memory anchored\\n& signed "];
}
"""

def save_ufd(dot, filename):
    encoded = urllib.parse.quote(dot)
    url = f"https://quickchart.io/graphviz?graph={encoded}&format=png"
    out_path = os.path.join(docs_dir, filename)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            with open(out_path, "wb") as f:
                f.write(response.read())
        print(f"Saved {filename}")
    except Exception as e:
        print(f"Failed to download {filename}: {e}")

save_ufd(ufd_dot, "ufd_flow.png")
