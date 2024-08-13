import { deepEqual, ok } from "node:assert/strict"
import { beforeEach, describe, it } from "node:test"

import { INestApplication } from "@nestjs/common"
import { Test, TestingModule } from "@nestjs/testing"
import { print } from "graphql"
import { gql } from "graphql-tag"
import * as request from "supertest"

import { AppModule } from "@/app/app.module"
import {
  authUserQuery,
  registerTemporalUserMutation,
} from "@/passport/authentication/test/authentication.e2e-spec"
import type { User } from "@/users/entities/user.entity"

const saveUserLocationMutation = gql`
  mutation SaveUserLocation($input: SaveUserLocationInput!) {
    saveUserLocation(saveUserLocationInput: $input) {
      id
      user {
        id
      }
      location
    }
  }
`

describe("MapResolver (e2e)", () => {
  let app: INestApplication
  const auth: { token: string; user: User } | Record<any, any> = {}

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    app = moduleFixture.createNestApplication()
    await app.init()

    const {
      body: {
        data: {
          registerTemporalUser: { token },
        },
      },
    } = await request(app.getHttpServer())
      .post("/graphql")
      .send({
        query: print(registerTemporalUserMutation),
      })
    const {
      body: {
        data: { authUser },
      },
    } = await request(app.getHttpServer())
      .post("/graphql")
      .set("Authorization", `Bearer ${token}`)
      .send({
        query: print(authUserQuery),
      })
    auth.token = token
    auth.user = authUser
  })

  describe("saveUserLocation", () => {
    it("should create and return a user location", async () => {
      const {
        body: {
          data: { saveUserLocation: created },
          errors,
        },
      } = await request(app.getHttpServer())
        .post("/graphql")
        .set("Authorization", `Bearer ${auth.token}`)
        .send({
          query: print(saveUserLocationMutation),
          variables: { input: { location: { lat: 10.0, lng: 11.0 } } },
        })
      deepEqual(errors, undefined)
      const { id, ...rest } = created
      ok(id)
      deepEqual(rest, {
        location: [11.0, 10.0],
        user: auth.user,
      })
    })

    it("should update and return a user existed location", async () => {
      const {
        body: {
          data: { saveUserLocation: created },
        },
      } = await request(app.getHttpServer())
        .post("/graphql")
        .set("Authorization", `Bearer ${auth.token}`)
        .send({
          query: print(saveUserLocationMutation),
          variables: { input: { location: { lat: 10.0, lng: 11.0 } } },
        })
      const {
        body: {
          data: { saveUserLocation: updated },
          errors,
        },
      } = await request(app.getHttpServer())
        .post("/graphql")
        .set("Authorization", `Bearer ${auth.token}`)
        .send({
          query: print(saveUserLocationMutation),
          variables: {
            input: {
              id: created.id,
              location: { lat: 12.0, lng: 14.0 },
            },
          },
        })
      deepEqual(errors, undefined)
      deepEqual(updated, {
        id: created.id,
        location: [12.0, 14.0],
        user: auth.user,
      })
    })
  })
})
