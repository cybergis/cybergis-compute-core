import SingCVMFSConnector from "../connectors/SingCVMFSConnector";
import CommunityContributionMaintainer from "./CommunityContributionMaintainer";

class SingCVMFSMaintainer extends CommunityContributionMaintainer {
  onDefine() {
    // define connector
    this.connector = this.getSingCVMFSConnector();
  }
}
export default SingCVMFSMaintainer;
