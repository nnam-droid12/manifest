import sys

from manifest_agents.carrier_vetting.agent import vet_carrier

if __name__ == "__main__":
    mc_number = sys.argv[1] if len(sys.argv) > 1 else "MC-1187765"
    result = vet_carrier(mc_number)
    print(result.narrative)
