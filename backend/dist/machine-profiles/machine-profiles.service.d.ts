import { Repository } from 'typeorm';
import { MachineProfile } from './entities/machine-profile.entity';
import { KnowledgeDocument } from '../knowledge-documents/entities/knowledge-document.entity';
import { KnowledgeEntry } from '../knowledge/entities/knowledge-entry.entity';
export type FindOrCreateMachineProfileInput = {
    machineName: string;
    manufacturer?: string | null;
    family?: string | null;
    modelNumber?: string | null;
    components?: string | string[] | null;
};
export declare class MachineProfilesService {
    private readonly machineProfilesRepository;
    private readonly knowledgeDocumentsRepository;
    private readonly knowledgeEntriesRepository;
    constructor(machineProfilesRepository: Repository<MachineProfile>, knowledgeDocumentsRepository: Repository<KnowledgeDocument>, knowledgeEntriesRepository: Repository<KnowledgeEntry>);
    findAll(): Promise<MachineProfile[]>;
    findOne(id: string): Promise<MachineProfile>;
    getAdminProfileSummary(id: string): Promise<{
        profile: MachineProfile;
        pdfDocumentCount: number;
        knowledgeEntriesApproxCount: number;
        knowledgeEntriesWithPhotoApproxCount: number;
    }>;
    findOrCreate(input: FindOrCreateMachineProfileInput): Promise<MachineProfile>;
    createManual(input: {
        machineName: string;
        manufacturer?: string | null;
        family?: string | null;
        modelNumber?: string | null;
        components?: string | null;
    }): Promise<MachineProfile>;
    updateManual(id: string, patch: {
        machineName?: string;
        manufacturer?: string | null;
        family?: string | null;
        modelNumber?: string | null;
        components?: string | null;
    }): Promise<MachineProfile>;
}
