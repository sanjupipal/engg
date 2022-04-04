import { NextFunction, Request, Response } from "express"
import { Group } from "../entity/group.entity"
import { Student } from "../entity/student.entity"
import { GroupStudent } from "../entity/group-student.entity"
import { getRepository, getManager } from "typeorm"
import { createGroup, metaDataInput, UpdateGroupInput } from "../interface/group.interface"
import { CreateGroupStudentInput } from "../interface/group-student.interface"
const moment = require("moment")
export class GroupController {
  private groupRepository = getRepository(Group)
  private studentRepository = getRepository(Student)
  private groupStudentRepository = getRepository(GroupStudent)
  private entityManager = getManager()

  async allGroups(request: Request, response: Response, next: NextFunction) {
    return this.groupRepository.find()
  }

  async createGroup(request: Request, response: Response, next: NextFunction) {
    const { body: params } = request

    const createRollInput: createGroup = {
      name: params.name,
      number_of_weeks: params.number_of_weeks,
      roll_states: params.roll_states,
      incidents: params.incidents,
      ltmt: params.ltmt,
    }
    const group = new Group()
    group.prepareToCreate(createRollInput)
    return this.groupRepository.save(group)
  }

  async updateGroup(request: Request, response: Response, next: NextFunction) {
    const { body: params } = request
    if (!params.id) throw new Error("Id required")
    this.groupRepository.findOne(params.id).then(async (group) => {
      if (!group) throw new Error("No Group Found")

      const updateGroupInput: UpdateGroupInput = {
        name: params.name,
        number_of_weeks: params.number_of_weeks,
        roll_states: params.roll_states,
        incidents: params.incidents,
        ltmt: params.ltmt,
      }
      group.prepareToUpdate(updateGroupInput)
      await this.groupRepository.save(group)
      return response.status(200).json({ msg: "group updated" })
    })
  }

  async removeGroup(request: Request, response: Response, next: NextFunction) {
    if (!request.params.id) throw new Error("Id required")
    let groupToRemove = await this.groupRepository.findOne(request.params.id)
    await this.groupRepository.remove(groupToRemove)
    return response.status(200).json({ msg: "deleted group" })
  }

  async getGroupStudents(request: Request, response: Response, next: NextFunction) {
    if (!request.params.id) throw new Error("Id required")
    return this.entityManager.query(
      `select s.id as id, s.first_name as first_name, s.last_name as last_name, s.first_name || ' ' || s.last_name as full_name from 'group_student' as gs join student as s on s.id = gs.student_id where gs.group_id = ${request.params.id}`
    )
  }

  async runGroupFilters(request: Request, response: Response, next: NextFunction) {
    await this.groupStudentRepository.delete({})

    this.groupRepository.find().then(async (groups) => {
      let groupRepoPromises = []
      for (let index = 0; index < groups.length; index++) {
        const element = groups[index]
        const { id, number_of_weeks, roll_states, incidents, ltmt } = element

        let states = roll_states.split(",")
        let query = `select srs.student_id from roll as r join 'student_roll_state' as srs 
        on srs.roll_id = r.id where srs.state in `
        if (states.length == 1) {
          query += `('${roll_states}')`
        } else {
          states.forEach((val, i) => {
            if (i == 0) {
              query += `('${val}',`
            } else if (i == states.length - 1) {
              query += `'${val}') `
            } else {
              query += `'${val}',`
            }
          })
        }
        query += ` AND r.completed_at > DATE('now','-${7 * number_of_weeks} day')`

        let data = await this.entityManager.query(query)

        let studentMap = {}
        data.forEach((element) => {
          if (!studentMap.hasOwnProperty(element.student_id)) studentMap[element.student_id] = 1
          else studentMap[element.student_id]++
        })

        let groupStudentPromises = []
        for (const studentId in studentMap) {
          const incidentCount = studentMap[studentId]
          if (ltmt === ">" ? incidentCount > incidents : incidentCount < incidents) {
            const createGroupStudentInput: CreateGroupStudentInput = {
              student_id: Number(studentId),
              group_id: id,
              incident_count: incidentCount,
            }
            const groupStudent = new GroupStudent()
            groupStudent.prepareToCreate(createGroupStudentInput)
            groupStudentPromises.push(this.groupStudentRepository.save(groupStudent))
          }
        }
        if (groupStudentPromises.length > 0) {
          await Promise.all(groupStudentPromises)
        }

        const updateGroupInput: metaDataInput = {
          run_at: new Date(),
          student_count: Object.keys(studentMap).length,
        }
        element.prepareToUpdateMetaData(updateGroupInput)
        groupRepoPromises.push(this.groupRepository.save(element))
      }
      await Promise.all(groupRepoPromises)
      return response.status(200).json({ msg: "success" })
    })
  }
}
