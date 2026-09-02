import sys

from manifest_agents.playbook_rag.agent import consult_playbook

if __name__ == "__main__":
    query = " ".join(sys.argv[1:]) or "booking Rapid Transit Logistics for a reefer load"
    result = consult_playbook(query)
    print(result.narrative)
