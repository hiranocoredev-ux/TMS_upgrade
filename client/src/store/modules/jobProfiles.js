import * as profileService from '../../services/jobProfiles';
import { buildProfileCollectionModule } from './profileCollectionFactory';

export default buildProfileCollectionModule(
  {
    fetchProfiles: profileService.fetchJobProfiles,
    getProfile: profileService.getJobProfile,
    createProfile: profileService.createJobProfile,
    updateProfile: profileService.updateJobProfile,
    deleteProfile: profileService.deleteJobProfile,
    uploadProfilePicture: profileService.uploadProfilePicture,
    uploadAttachments: profileService.uploadAttachments,
    uploadAttachment: profileService.uploadAttachment,
    deleteAttachment: profileService.deleteAttachment
  },
  { group: '' }
);
