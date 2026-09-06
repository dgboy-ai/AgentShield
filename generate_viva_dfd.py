import urllib.parse
import urllib.request
import os

docs_dir = r"C:\projects\AgentShield\docs"
os.makedirs(docs_dir, exist_ok=True)

# LEVEL 0 CONTEXT DIAGRAM
level0_dot = """
digraph Level0 {
    graph [label="Level-0 Context Diagram: AgentShield\\nLegend: D1..D7 = CockroachDB (faded-wallaby) internal stores", labelloc="t", fontsize=16, fontname="Arial"];
    rankdir=TB;
    node [fontname="Arial", fontsize=12, penwidth=2];
    edge [fontname="Arial", fontsize=10];

    // System
    node [shape=circle, style=bold, fixedsize=true, width=1.6];
    System [label="0.0\\nAgentShield\\nSystem"];

    // External Entities
    node [shape=box, style=bold, width=1.8, height=0.6];
    LLM [label="Developer/\\nLLM Agent"];
    Admin [label="Security Admin"];
    Auditor [label="Compliance\\nAuditor"];
    KMS [label="AWS KMS"];
    Webhook [label="S3 / Webhooks"];
    UI [label="Frontend\\nNext.js"];

    // Flows
    LLM -> System [label=" memory_content "];
    System -> LLM [label=" receipt (entry_hash) "];

    Admin -> UI [label=" admin actions "];
    Auditor -> UI [label=" compliance request "];
    UI -> System [label=" JWT Auth & API "];
    System -> UI [label=" API responses "];

    System -> KMS [label=" signature req "];
    KMS -> System [label=" kms_signature "];

    System -> Webhook [label=" external anchor "];
}
"""

# LEVEL 1 DECOMPOSITION
level1_dot = """
digraph Level1 {
    graph [label="Level-1 Decomposition Diagram: AgentShield", labelloc="t", fontsize=16, fontname="Arial"];
    rankdir=TB; 
    node [fontname="Arial", fontsize=12, penwidth=2];
    edge [fontname="Arial", fontsize=10];
    splines=true; // Curved lines handle overlapping better than ortho
    nodesep=0.6;
    ranksep=0.9;

    // External Entities
    node [shape=box, style=bold, width=1.5, height=0.5];
    LLM [label="Developer/\\nLLM Agent"];
    UI [label="Frontend\\nNext.js"];
    KMS [label="AWS KMS"];
    Webhook [label="S3/Webhook"];

    // Processes
    node [shape=circle, style=bold, fixedsize=true, width=1.3];
    P1 [label="P1\\nAuth\\nEngine"];
    P2 [label="P2\\nConstraint\\nPinning"];
    P3 [label="P3\\nMemory\\nStore"];
    P4 [label="P4\\nPattern\\nDetection"];
    P5 [label="P5\\nHash\\nChain"];
    P6 [label="P6\\nSigning\\nEngine"];
    P7 [label="P7\\nAudit\\nTrail"];
    P8 [label="P8\\nCompliance\\nReport"];
    P9 [label="P9\\nAnchoring\\nSystem\\n(grace=3600)"];

    // Data Stores
    node [shape=note, style=bold, width=1.4, height=0.5];
    D1 [label="D1:\\norganizations"];
    D2 [label="D2:\\nusers"];
    D3 [label="D3:\\nmemories"];
    D4 [label="D4:\\nconstraints"];
    D5 [label="D5:\\naudit_log"];
    D6 [label="D6:\\nchain_anchors"];
    D7 [label="D7:\\nalerts"];

    // Flows
    UI -> P1 [label=" reg/login/refresh "];
    P1 -> D1 [label=" create org (org_id) "];
    P1 -> D2 [label=" read/write "];
    
    UI -> P2 [label=" constraint_text+type "];
    P2 -> D4 [label=" save constraint "];
    
    // Use weight/constraint to help layout and avoid crossing P2->P7 and P3->P5
    P2 -> P5 [label=" generate entry_hash "];

    LLM -> P3 [label=" memory_content "];
    P3 -> P4 [label=" scan_text "];
    P4 -> D7 [label=" risk_score / blocked "];
    P3 -> P5 [label=" seq_number + hash req "];
    P5 -> P6 [label=" payload + prev_hash "];
    
    P6 -> KMS [label=" payload "];
    KMS -> P6 [label=" kms_signature "];
    P6 -> P3 [label=" signed entry_hash "];
    P3 -> D3 [label=" save memory "];

    P3 -> P7 [label=" audit event ", constraint=false];
    P2 -> P7 [label=" audit event "];
    P1 -> P7 [label=" auth event ", constraint=false];
    P7 -> D5 [label=" log record "];

    UI -> P8 [label=" query compliance "];
    P8 -> D5 [label=" AS OF SYSTEM TIME "];

    P9 -> D5 [label=" fetch latest logs "];
    P9 -> D6 [label=" head_hash->chain_anchors "];
    P9 -> Webhook [label=" external sync "];
}
"""

def save_dfd(dot, filename):
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

save_dfd(level0_dot, "dfd_level0.png")
save_dfd(level1_dot, "dfd_level1.png")
