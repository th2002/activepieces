import { ActivepiecesError, Cursor, ErrorCode, Folder,  FolderDto, ProjectId } from '@activepieces/shared'
import { databaseConnection } from '../../database/database-connection'
import { FolderEntity } from './folder.entity'
import { CreateOrRenameFolderRequest, FolderId, apId } from '@activepieces/shared'
import { paginationHelper } from '../../helper/pagination/pagination-utils'
import { buildPaginator } from '../../helper/pagination/build-paginator'
import { flowService } from '../flow/flow.service'

export const folderRepo = databaseConnection.getRepository(FolderEntity)

export const flowFolderService = {
    async delete({ projectId, folderId }: { projectId: ProjectId, folderId: FolderId }) {
        await folderRepo.delete({
            id: folderId,
            projectId: projectId,
        })
    },
    async update({ projectId, folderId, request }: { projectId, folderId: FolderId, request: CreateOrRenameFolderRequest }) : Promise<Folder>{
        const folder = await folderRepo.findOneBy({
            projectId,
            id: folderId,
        })
        if (folder === null || folder === undefined) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: {
                    message: `Folder ${folderId} is not found`,
                },
            })
        }
        await folderRepo.update(folderId, {
            ...folder,
            displayName: request.displayName,
        })
        return await folderRepo.findOneBy({
            projectId,
            id: folderId,
        })
    },
    async create({ projectId, request }: { projectId, request: CreateOrRenameFolderRequest }): Promise<FolderDto> {
        const folder= await folderRepo.save({
            id: apId(),
            projectId: projectId,
            displayName: request.displayName,
        })
        return {
            ...folder,
            numberOfFlows:0
        }
    },
    async list({ projectId, cursorRequest, limit }: { projectId: ProjectId, cursorRequest: Cursor | null, limit: number }) {
        const decodedCursor = paginationHelper.decodeCursor(cursorRequest)
        const paginator = buildPaginator({
            entity: FolderEntity,
            query: {
                limit,
                order: 'ASC',
                afterCursor: decodedCursor.nextCursor,
                beforeCursor: decodedCursor.previousCursor,
            },
        })
        const paginationResponse = await paginator.paginate(folderRepo.createQueryBuilder('folder').where({ projectId }))
        const numberOfFlowForEachFolder :Promise<number>[] =[]
        const dtosList:FolderDto[] =[]
        paginationResponse.data.forEach((f)=>{
            numberOfFlowForEachFolder.push(flowService.count({projectId:projectId, folderId:f.id}))
        });
        (await Promise.all(numberOfFlowForEachFolder)).forEach((num, idx)=>{
            dtosList.push({...paginationResponse.data[idx], numberOfFlows:num})
        })
        return paginationHelper.createPage<FolderDto>(dtosList, paginationResponse.cursor)
    },
    async getOne({projectId, folderId}) : Promise<FolderDto | null> {
        const folder = await folderRepo.findOneBy({projectId,id:folderId})
        if(!folder)
        {
            return null;
        }
        const numberOfFlows = await flowService.count({projectId:projectId, folderId:folderId});
        return {
            ...folder,
            numberOfFlows:numberOfFlows
        }
    }
    
}
