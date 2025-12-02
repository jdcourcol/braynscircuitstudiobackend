#!/bin/bash -l

#SBATCH --account=proj3
#SBATCH -p prod
#SBATCH -t 8:00:00
#SBATCH --exclusive
#SBATCH --constraint=cpu
#SBATCH -c 80
#SBATCH --mem 0
#SBATCH -N 1

# echo "Starting Brayns..."
# module purge
# module load unstable
# module load brayns/3.10.0

# braynsService \
#     --uri 0.0.0.0:5000 \
#     --log-level debug \
#     --plugin braynsCircuitExplorer > ./output/logs/brayns-$1.log 2>&1 &

# echo "Activating Python virtual environment..."
# . ./.brayns-venv/bin/activate
# echo "Starting agent $1/$2..."
uv run agent.py 127.0.0.1:5000 0/1 > ./output/logs/agent-1.log 2>&1
# deactivate

# echo "Terminating the current job..."
# scancel --name="BraynsAgent$1"

