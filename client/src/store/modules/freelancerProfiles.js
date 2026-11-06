import * as profileService from '../../services/freelancerProfiles';
import { buildProfileCollectionModule } from './profileCollectionFactory';

export default buildProfileCollectionModule({
  fetchProfiles: profileService.fetchFreelancerProfiles,
  getProfile: profileService.getFreelancerProfile,
  createProfile: profileService.createFreelancerProfile,
  updateProfile: profileService.updateFreelancerProfile,
  deleteProfile: profileService.deleteFreelancerProfile,
  uploadProfilePicture: profileService.uploadProfilePicture,
  uploadAttachments: profileService.uploadAttachments,
  uploadAttachment: profileService.uploadAttachment,
  deleteAttachment: profileService.deleteAttachment
});
