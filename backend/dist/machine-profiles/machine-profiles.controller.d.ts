import { MachineProfilesService } from './machine-profiles.service';
import { CreateMachineProfileDto, UpdateMachineProfileDto } from './dto/machine-profile-mutations.dto';
export declare class MachineProfilesController {
    private readonly machineProfilesService;
    constructor(machineProfilesService: MachineProfilesService);
    findAll(): Promise<import("./entities/machine-profile.entity").MachineProfile[]>;
    create(body: CreateMachineProfileDto): Promise<import("./entities/machine-profile.entity").MachineProfile>;
    adminSummary(id: string): Promise<{
        profile: import("./entities/machine-profile.entity").MachineProfile;
        pdfDocumentCount: number;
        knowledgeEntriesApproxCount: number;
        knowledgeEntriesWithPhotoApproxCount: number;
    }>;
    update(id: string, body: UpdateMachineProfileDto): Promise<import("./entities/machine-profile.entity").MachineProfile>;
    findOne(id: string): Promise<import("./entities/machine-profile.entity").MachineProfile>;
}
