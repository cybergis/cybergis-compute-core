import urllib.request, json

CYBERGIS_COMPUTE_SERVER='https://cgjobsup.cigi.illinois.edu/v2/git'

def get_model_repos_for_hpc(hpc_name:str) -> list[str]:
    git_repos = []
    with urllib.request.urlopen(CYBERGIS_COMPUTE_SERVER) as url:
        data = json.load(url)        
        print(len(data['git']))
        for model, value in data['git'].items():
            if hpc_name in value['supported_hpc']:
                git_repos.append(value["repository"])
                pass
            pass
        pass
    return git_repos

if __name__ == '__main__':
    repos = get_model_repos_for_hpc(hpc_name='anvil_community')
    for r in repos:
        print(r)
