import SingCVMFSConnector from "../connectors/SingCVMFSConnector";
import ComminityMaintainer from "./CommunityMaintainer";

class SingCVMFSMaintainer extends ComminityMaintainer {
  public connector: SingCVMFSConnector;

  public resultFolderContentManager: ResultFolderContentManager =
    new ResultFolderContentManager();

  public executableManifest: executableManifest;

  onDefine() {
    // define connector
    this.connector = this.getSingCVMFSConnector();
  }
}
export default SingCVMFSMaintainer;
